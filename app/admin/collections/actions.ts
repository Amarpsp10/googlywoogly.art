"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { Prisma, CollectionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { NON_STAFF_ROLES } from "@/lib/auth/types";
import { writeAudit } from "@/lib/admin/audit";
import { revalidateCollection, revalidateHome } from "@/lib/revalidate";
import { cacheTags } from "@/lib/cache-tags";
import { slugify, uniqueSlug } from "@/lib/slug";
import { ok, fail, failValidation, type ActionResult } from "@/lib/result";
import {
  collectionInputSchema,
  setCollectionProductsSchema,
  reorderCollectionsSchema,
  deleteCollectionSchema,
} from "./schema";

/**
 * Collection management Server Actions (docs/11 §3.10/§3.15, §6.3). Every action:
 *  (1) `requireRole(owner|admin)` — `staff` is barred from merchandising,
 *  (2) validates with the co-located Zod schema,
 *  (3) mutates inside a `$transaction`,
 *  (4) `writeAudit(...)` with a `collection.*` action name,
 *  (5) revalidates `collection:{slug}` + `products` (+ `nav`, + `home` when
 *      featured-on-home), with `revalidatePath('/collections/{old}')` on a slug
 *      change (docs/11 FR-63),
 *  (6) returns an `ActionResult`.
 *
 * Manual is the MVP membership model (explicit `CollectionProduct` rows ordered
 * by `sortOrder`). Automated rules are a **V1 stub** (`recomputeAutomatedCollection`
 * is a no-op materialization for now — FR-41/§12 flag).
 */

const COLLECTION_ROLES = NON_STAFF_ROLES;

/** Bust the header/footer nav tag (collections surface in nav — FR-63). */
function bustNav(): void {
  revalidateTag(cacheTags.nav, "max");
}

/** Fields echoed into the audit log (PII-free merchandising data). */
const auditSelect = {
  id: true,
  slug: true,
  title: true,
  type: true,
  sortOrder: true,
  isActive: true,
  isFeaturedOnHome: true,
} satisfies Prisma.CollectionSelect;

/** Write a 301 `Redirect` from the old storefront collection path to the new one. */
async function writeCollectionRedirect(
  tx: Prisma.TransactionClient,
  oldSlug: string,
  newSlug: string,
): Promise<void> {
  const fromPath = `/collections/${oldSlug}`;
  const toPath = `/collections/${newSlug}`;
  await tx.redirect.upsert({
    where: { fromPath },
    create: { fromPath, toPath, statusCode: 301 },
    update: { toPath, statusCode: 301 },
  });
  await tx.redirect.updateMany({
    where: { toPath: fromPath },
    data: { toPath },
  });
}

// ───────────────────────────── upsertCollection ─────────────────────────────

/**
 * Create or update a collection. A changed slug writes a 301 `Redirect` and
 * revalidates the old path. Automated collections trigger a (V1) membership
 * recompute. Revalidates `collection:{slug}` + `products` + `nav` (+ `home` when
 * featured-on-home, including a transition either way).
 */
export async function upsertCollection(
  raw: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const admin = await requireRole(COLLECTION_ROLES);

  const parsed = collectionInputSchema.safeParse(raw);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  const existing = input.id
    ? await prisma.collection.findUnique({
        where: { id: input.id },
        select: { id: true, slug: true, isFeaturedOnHome: true },
      })
    : null;
  if (input.id && !existing) return fail("That collection no longer exists.");

  // Resolve a unique slug (explicit, else derived from the title).
  const desired = input.slug ?? slugify(input.title);
  const slug = await uniqueSlug(
    desired,
    async (candidate) => {
      const hit = await prisma.collection.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      return hit !== null && hit.id !== input.id;
    },
    existing?.slug,
  );

  const data = {
    title: input.title,
    slug,
    description: input.description ?? null,
    heroImageId: input.heroImageId ?? null,
    type: input.type,
    rules:
      input.type === CollectionType.automated && input.rules
        ? (input.rules as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    isFeaturedOnHome: input.isFeaturedOnHome,
    metaTitle: input.metaTitle ?? null,
    metaDescription: input.metaDescription ?? null,
  };

  const slugChanged = Boolean(existing && existing.slug !== slug);

  const saved = await prisma.$transaction(async (tx) => {
    if (existing) {
      const before = await tx.collection.findUnique({
        where: { id: existing.id },
        select: auditSelect,
      });
      const after = await tx.collection.update({
        where: { id: existing.id },
        data,
        select: auditSelect,
      });
      if (slugChanged) await writeCollectionRedirect(tx, existing.slug, slug);
      await writeAudit(
        { adminId: admin.id, action: "collection.update", entityType: "Collection", entityId: after.id, before, after },
        tx,
      );
      return after;
    }

    const after = await tx.collection.create({ data, select: auditSelect });
    await writeAudit(
      { adminId: admin.id, action: "collection.create", entityType: "Collection", entityId: after.id, after },
      tx,
    );
    return after;
  });

  // Automated collections: (re)materialize membership from rules (V1 stub).
  if (saved.type === CollectionType.automated) {
    await recomputeAutomatedCollection({ collectionId: saved.id });
  }

  // Revalidate the new slug + products + nav; home when featured now or before.
  revalidateCollection(slug);
  bustNav();
  if (input.isFeaturedOnHome || existing?.isFeaturedOnHome) revalidateHome();
  if (existing && existing.slug !== slug) {
    revalidateCollection(existing.slug);
    revalidatePath(`/collections/${existing.slug}`);
  }

  return ok({ id: saved.id, slug: saved.slug });
}

// ───────────────────────────── setCollectionProducts ─────────────────────────────

/**
 * Replace a **manual** collection's membership with `items` (ordered by their
 * `sortOrder`). Automated collections reject here — their membership is rule-
 * derived (FR-61). Densely re-indexes `sortOrder` (0-based) from the given order
 * and validates every product id exists. Revalidates `collection:{slug}` +
 * `products`.
 */
export async function setCollectionProducts(raw: unknown): Promise<ActionResult> {
  const admin = await requireRole(COLLECTION_ROLES);

  const parsed = setCollectionProductsSchema.safeParse(raw);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const { collectionId, items } = parsed.data;

  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { id: true, slug: true, type: true, isFeaturedOnHome: true },
  });
  if (!collection) return fail("That collection no longer exists.");
  if (collection.type === CollectionType.automated) {
    return fail("This is an automated collection — its products are set by rules, not by hand.");
  }

  // De-duplicate by productId (keep first occurrence) and re-index densely.
  const seen = new Set<string>();
  const ordered: { productId: string; sortOrder: number }[] = [];
  for (const it of [...items].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (seen.has(it.productId)) continue;
    seen.add(it.productId);
    ordered.push({ productId: it.productId, sortOrder: ordered.length });
  }

  // Guard: every referenced product must exist.
  if (ordered.length > 0) {
    const found = await prisma.product.count({
      where: { id: { in: ordered.map((o) => o.productId) } },
    });
    if (found !== ordered.length) {
      return fail("Some selected products no longer exist — refresh and try again.");
    }
  }

  await prisma.$transaction(async (tx) => {
    const before = await tx.collectionProduct.findMany({
      where: { collectionId },
      orderBy: { sortOrder: "asc" },
      select: { productId: true, sortOrder: true },
    });

    // Replace the set: clear, then recreate in the new order.
    await tx.collectionProduct.deleteMany({ where: { collectionId } });
    if (ordered.length > 0) {
      await tx.collectionProduct.createMany({
        data: ordered.map((o) => ({
          collectionId,
          productId: o.productId,
          sortOrder: o.sortOrder,
        })),
      });
    }

    await writeAudit(
      {
        adminId: admin.id,
        action: "collection.set_members",
        entityType: "Collection",
        entityId: collectionId,
        before: { count: before.length, items: before },
        after: { count: ordered.length, items: ordered },
      },
      tx,
    );
  });

  revalidateCollection(collection.slug);
  if (collection.isFeaturedOnHome) revalidateHome();

  return ok(undefined);
}

// ───────────────────────────── reorderCollections ─────────────────────────────

/**
 * Persist a new dense `sortOrder` across a set of collections (list reorder,
 * FR-63). Revalidates `nav` (+ `home`, since featured collections surface there).
 */
export async function reorderCollections(raw: unknown): Promise<ActionResult> {
  const admin = await requireRole(COLLECTION_ROLES);

  const parsed = reorderCollectionsSchema.safeParse(raw);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const { orders } = parsed.data;

  const ids = orders.map((o) => o.id);
  const found = await prisma.collection.count({ where: { id: { in: ids } } });
  if (found !== ids.length) {
    return fail("Some collections no longer exist — refresh and try again.");
  }

  await prisma.$transaction(async (tx) => {
    for (const o of orders) {
      await tx.collection.update({
        where: { id: o.id },
        data: { sortOrder: o.sortOrder },
      });
    }
    await writeAudit(
      {
        adminId: admin.id,
        action: "collection.reorder",
        entityType: "Collection",
        entityId: ids[0],
        after: { orders },
      },
      tx,
    );
  });

  bustNav();
  revalidateHome();
  return ok(undefined);
}

// ───────────────────────────── deleteCollection ─────────────────────────────

/**
 * Delete a collection. `CollectionProduct` rows cascade (schema `onDelete:
 * Cascade`); products themselves are untouched. Revalidates `collection:{slug}` +
 * `products` + `nav` (+ `home` when it was featured).
 */
export async function deleteCollection(raw: unknown): Promise<ActionResult> {
  const admin = await requireRole(COLLECTION_ROLES);

  const parsed = deleteCollectionSchema.safeParse(raw);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const { id } = parsed.data;

  const collection = await prisma.collection.findUnique({
    where: { id },
    select: { id: true, slug: true, title: true, isFeaturedOnHome: true },
  });
  if (!collection) return fail("That collection no longer exists.");

  await prisma.$transaction(async (tx) => {
    await tx.collection.delete({ where: { id } });
    await writeAudit(
      {
        adminId: admin.id,
        action: "collection.delete",
        entityType: "Collection",
        entityId: id,
        before: { id: collection.id, slug: collection.slug, title: collection.title },
      },
      tx,
    );
  });

  revalidateCollection(collection.slug);
  bustNav();
  if (collection.isFeaturedOnHome) revalidateHome();
  revalidatePath(`/collections/${collection.slug}`);

  return ok(undefined);
}

// ───────────────────────────── product search (membership picker) ─────────────────────────────

/** A minimal product row for the manual-membership picker UI. */
export interface AddableProduct {
  id: string;
  title: string;
  sku: string;
  price: number;
  imageUrl: string | null;
}

/**
 * Search products to add to a manual collection (docs/11 FR-61 "search/add active
 * products"). Owner/admin only. Matches active products by title or SKU, excludes
 * ids already in the collection, and returns a small capped result for the picker.
 */
export async function searchAddableProducts(args: {
  query: string;
  excludeIds?: string[];
  limit?: number;
}): Promise<ActionResult<AddableProduct[]>> {
  await requireRole(COLLECTION_ROLES);

  const query = String(args?.query ?? "").trim();
  const excludeIds = Array.isArray(args?.excludeIds) ? args.excludeIds : [];
  const limit = Math.min(Math.max(Number(args?.limit ?? 20), 1), 50);

  const where: Prisma.ProductWhereInput = {
    status: "active",
    ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { sku: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await prisma.product.findMany({
    where,
    orderBy: [{ isBestseller: "desc" }, { title: "asc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      sku: true,
      price: true,
      primaryImage: { select: { url: true } },
    },
  });

  return ok(
    rows.map((p) => ({
      id: p.id,
      title: p.title,
      sku: p.sku,
      price: p.price,
      imageUrl: p.primaryImage?.url ?? null,
    })),
  );
}

// ───────────────────────────── recomputeAutomatedCollection (V1 stub) ─────────────────────────────

/**
 * **V1 stub** (docs/11 FR-41 / §12, flag `COLLECTIONS_AUTOMATION_ENABLED`).
 *
 * The shipped MVP is the **manual** membership path; automated collections are
 * accepted and stored (their `rules` persist) but membership materialization is
 * intentionally a no-op here. When the automation flag lands, this is where the
 * rule query runs and `CollectionProduct` rows are materialized, then
 * `collection:{slug}` + `products` are revalidated.
 *
 * Returns `{ matched }` (currently the count of already-materialized members) so
 * callers/cron have a stable contract. Audited as `collection.recompute`.
 */
export async function recomputeAutomatedCollection(raw: {
  collectionId: string;
}): Promise<ActionResult<{ matched: number }>> {
  const admin = await requireRole(COLLECTION_ROLES);

  const collectionId = String(raw?.collectionId ?? "").trim();
  if (!collectionId) return fail("Missing collection id.");

  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { id: true, slug: true, type: true },
  });
  if (!collection) return fail("That collection no longer exists.");
  if (collection.type !== CollectionType.automated) {
    return fail("Only automated collections can be recomputed.");
  }

  // MVP: no rule evaluation yet — report the current materialized member count.
  const matched = await prisma.collectionProduct.count({
    where: { collectionId },
  });

  await writeAudit({
    adminId: admin.id,
    action: "collection.recompute",
    entityType: "Collection",
    entityId: collectionId,
    after: { matched, materialized: false, note: "V1 stub — rules not yet evaluated" },
  });

  revalidateCollection(collection.slug);
  return ok({ matched });
}
