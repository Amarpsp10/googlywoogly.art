"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { NON_STAFF_ROLES } from "@/lib/auth/types";
import { writeAudit } from "@/lib/admin/audit";
import { revalidateCategory } from "@/lib/revalidate";
import { slugify, uniqueSlug } from "@/lib/slug";
import { ok, fail, failValidation, type ActionResult } from "@/lib/result";
import {
  categoryInputSchema,
  reorderCategoriesSchema,
  deleteCategorySchema,
} from "./schema";

/**
 * Category management Server Actions (docs/11 §3.14, §6.3). Every action:
 *  (1) `requireRole(owner|admin)` — `staff` is barred from taxonomy (docs/11 §1.3),
 *  (2) validates with the co-located Zod schema,
 *  (3) mutates inside a `$transaction`,
 *  (4) `writeAudit(...)` with a `category.*` action name,
 *  (5) revalidates `category:{slug}` + `products` + `nav` (via `revalidateCategory`),
 *      adding `revalidatePath('/category/{old}')` on a slug change (docs/11 FR-59),
 *  (6) returns an `ActionResult`.
 *
 * Depth is one level (CANON): a category that **has children** can't be made a
 * child, and a chosen `parentId` must itself be top-level (FR-57). Delete is
 * `Restrict`-guarded: blocked while products are attached unless a `reassignToId`
 * is supplied to move them first (FR-58).
 */

const CATEGORY_ROLES = NON_STAFF_ROLES;

/** Fields echoed into the audit log (PII-free taxonomy data). */
const auditSelect = {
  id: true,
  slug: true,
  name: true,
  parentId: true,
  sortOrder: true,
  isActive: true,
} satisfies Prisma.CategorySelect;

/** Write a 301 `Redirect` from the old storefront category path to the new one. */
async function writeCategoryRedirect(
  tx: Prisma.TransactionClient,
  oldSlug: string,
  newSlug: string,
): Promise<void> {
  const fromPath = `/category/${oldSlug}`;
  const toPath = `/category/${newSlug}`;
  await tx.redirect.upsert({
    where: { fromPath },
    create: { fromPath, toPath, statusCode: 301 },
    update: { toPath, statusCode: 301 },
  });
  // Re-point any existing redirects that chained to the old slug.
  await tx.redirect.updateMany({
    where: { toPath: fromPath },
    data: { toPath },
  });
}

// ───────────────────────────── upsertCategory ─────────────────────────────

/**
 * Create or update a category. On update, a changed slug writes a 301 `Redirect`
 * for `/category/{old}` and triggers `revalidatePath` of the old path. Returns
 * the new `{ id, slug }`.
 */
export async function upsertCategory(
  raw: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const admin = await requireRole(CATEGORY_ROLES);

  const parsed = categoryInputSchema.safeParse(raw);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  // Load the existing row (for updates) to detect slug changes & guard depth.
  const existing = input.id
    ? await prisma.category.findUnique({
        where: { id: input.id },
        select: { id: true, slug: true, parentId: true, _count: { select: { children: true } } },
      })
    : null;
  if (input.id && !existing) return fail("That category no longer exists.");

  // Resolve a unique slug: honour an explicit slug, else derive from the name.
  const desired = input.slug ?? slugify(input.name);
  const slug = await uniqueSlug(
    desired,
    async (candidate) => {
      const hit = await prisma.category.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      return hit !== null && hit.id !== input.id;
    },
    existing?.slug,
  );

  // ── Depth guard (one level, CANON) ──────────────────────────────────────
  let parentId = input.parentId ?? null;
  if (parentId) {
    if (parentId === input.id) {
      return failValidation({ parentId: ["A category can't be its own parent."] });
    }
    // A category that itself has children can't be nested under a parent.
    if (existing && existing._count.children > 0) {
      return failValidation({
        parentId: ["This category has sub-categories, so it can't become a child."],
      });
    }
    // The chosen parent must be top-level (no grandparents).
    const parent = await prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true },
    });
    if (!parent) {
      return failValidation({ parentId: ["The selected parent no longer exists."] });
    }
    if (parent.parentId) {
      return failValidation({
        parentId: ["Pick a top-level category — nesting is only one level deep."],
      });
    }
  }

  const data = {
    name: input.name,
    slug,
    description: input.description ?? null,
    imageId: input.imageId ?? null,
    parentId,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    metaTitle: input.metaTitle ?? null,
    metaDescription: input.metaDescription ?? null,
  };

  const slugChanged = Boolean(existing && existing.slug !== slug);

  const saved = await prisma.$transaction(async (tx) => {
    if (existing) {
      const before = await tx.category.findUnique({
        where: { id: existing.id },
        select: auditSelect,
      });
      const after = await tx.category.update({
        where: { id: existing.id },
        data,
        select: auditSelect,
      });
      if (slugChanged) {
        await writeCategoryRedirect(tx, existing.slug, slug);
      }
      await writeAudit(
        { adminId: admin.id, action: "category.update", entityType: "Category", entityId: after.id, before, after },
        tx,
      );
      return after;
    }

    const after = await tx.category.create({ data, select: auditSelect });
    await writeAudit(
      { adminId: admin.id, action: "category.create", entityType: "Category", entityId: after.id, after },
      tx,
    );
    return after;
  });

  // Revalidate the new slug + products + nav; bust the old storefront path too.
  revalidateCategory(slug);
  if (existing && existing.slug !== slug) {
    revalidateCategory(existing.slug);
    revalidatePath(`/category/${existing.slug}`);
  }

  return ok({ id: saved.id, slug: saved.slug });
}

// ───────────────────────────── reorderCategories ─────────────────────────────

/**
 * Persist a new dense `sortOrder` (and optional reparent) for a set of
 * categories. Depth is re-checked per row so the drag-sort UI can't create an
 * illegal two-level nest (FR-57). Revalidates each touched slug + products + nav.
 */
export async function reorderCategories(raw: unknown): Promise<ActionResult> {
  const admin = await requireRole(CATEGORY_ROLES);

  const parsed = reorderCategoriesSchema.safeParse(raw);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const { orders } = parsed.data;

  const ids = orders.map((o) => o.id);
  const rows = await prisma.category.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, _count: { select: { children: true } } },
  });
  if (rows.length !== ids.length) {
    return fail("Some categories no longer exist — refresh and try again.");
  }
  const childCount = new Map(rows.map((r) => [r.id, r._count.children]));

  // Validate every requested reparent against the one-level rule before writing.
  for (const o of orders) {
    const nextParent = o.parentId ?? null;
    if (!nextParent) continue;
    if (nextParent === o.id) {
      return fail("A category can't be its own parent.");
    }
    if ((childCount.get(o.id) ?? 0) > 0) {
      return fail("A category with sub-categories can't become a child.");
    }
    const parent = await prisma.category.findUnique({
      where: { id: nextParent },
      select: { parentId: true },
    });
    if (!parent || parent.parentId) {
      return fail("Categories can only nest one level deep.");
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const o of orders) {
      await tx.category.update({
        where: { id: o.id },
        data: {
          sortOrder: o.sortOrder,
          // Only touch parentId when the caller explicitly provided it.
          ...(o.parentId !== undefined ? { parentId: o.parentId ?? null } : {}),
        },
      });
    }
    await writeAudit(
      {
        adminId: admin.id,
        action: "category.reorder",
        entityType: "Category",
        entityId: ids[0],
        after: { orders },
      },
      tx,
    );
  });

  for (const r of rows) revalidateCategory(r.slug);
  return ok(undefined);
}

// ───────────────────────────── deleteCategory ─────────────────────────────

/** Successful-delete payload — `blocked` is set when the guard stopped a delete. */
export interface DeleteCategoryResult {
  blocked: boolean;
  /** Attached-product count (only meaningful when `blocked`). */
  productCount: number;
}

/**
 * Delete a category. Blocked (`Restrict`) while products are attached unless a
 * `reassignToId` is supplied — then those products move first, in the same
 * transaction (FR-58). Children are detached (`parentId → null`) by the schema's
 * `SetNull`. When the guard fires, returns `ok({ blocked: true, productCount })`
 * (not an error) so the UI can open the "move products" helper without surfacing
 * a scary toast; a true failure (missing row, bad target) returns `fail`.
 */
export async function deleteCategory(
  raw: unknown,
): Promise<ActionResult<DeleteCategoryResult>> {
  const admin = await requireRole(CATEGORY_ROLES);

  const parsed = deleteCategorySchema.safeParse(raw);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const { id, reassignToId } = parsed.data;

  const category = await prisma.category.findUnique({
    where: { id },
    select: { id: true, slug: true, name: true, _count: { select: { products: true } } },
  });
  if (!category) return fail("That category no longer exists.");

  const productCount = category._count.products;

  // Guard, not an error: tell the UI to offer reassignment.
  if (productCount > 0 && !reassignToId) {
    return ok({ blocked: true, productCount });
  }

  // Validate the reassignment target (must exist and differ from the deletee).
  let targetSlug: string | null = null;
  if (productCount > 0 && reassignToId) {
    if (reassignToId === id) {
      return fail("Choose a different category to move the products to.");
    }
    const target = await prisma.category.findUnique({
      where: { id: reassignToId },
      select: { id: true, slug: true },
    });
    if (!target) return fail("The category you picked to move products to no longer exists.");
    targetSlug = target.slug;
  }

  await prisma.$transaction(async (tx) => {
    if (productCount > 0 && reassignToId) {
      await tx.product.updateMany({
        where: { categoryId: id },
        data: { categoryId: reassignToId },
      });
    }
    await tx.category.delete({ where: { id } });
    await writeAudit(
      {
        adminId: admin.id,
        action: "category.delete",
        entityType: "Category",
        entityId: id,
        before: { id: category.id, slug: category.slug, name: category.name },
        after: { reassignedTo: reassignToId ?? null, movedProducts: reassignToId ? productCount : 0 },
      },
      tx,
    );
  });

  revalidateCategory(category.slug);
  if (targetSlug) revalidateCategory(targetSlug);
  revalidatePath(`/category/${category.slug}`);

  return ok({ blocked: false, productCount: 0 });
}
