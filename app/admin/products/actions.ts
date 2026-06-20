"use server";

import { Prisma, type ProductStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/admin/audit";
import {
  ok,
  fail,
  failValidation,
  type ActionResult,
} from "@/lib/result";
import {
  adminProductInputSchema,
  type AdminProductInput,
} from "@/lib/validations/catalog";
import { slugify, uniqueSlug } from "@/lib/slug";
import { deriveInventoryState, type InventoryState } from "@/lib/inventory";
import {
  publishGateErrors,
  resolveAdjustedQuantity,
  ADJUST_REASONS,
  type AdjustReason,
} from "@/lib/admin/product-rules";
import {
  revalidateCatalog,
  revalidateProduct,
  revalidateCategory,
  revalidateCollection,
  revalidateHome,
  revalidateSitemap,
} from "@/lib/revalidate";

/**
 * Product + inventory Server Actions (docs/11 §6). Every mutating action:
 *   (1) `requireAdmin()` / `requireRole()` for authz (docs/11 §1.3),
 *   (2) validates input with the EXISTING Zod schemas (catalog),
 *   (3) writes via prisma (transactional where multi-row),
 *   (4) `writeAudit(...)` with a CANON dot-cased action name,
 *   (5) calls the matching `revalidate*` helper for the affected cache tags,
 *   (6) returns an `ActionResult`.
 *
 * Money is integer **paise** — the client form converts ₹ → paise before calling
 * so these payloads are already in paise (docs/11 FR-3). The publish gate
 * (status=active needs price>0, ≥1 image, categoryId, MTO lead time) is enforced
 * HERE because it needs media/category context the pure schema lacks (FR-4).
 *
 * `staff` may only adjust inventory (`adjustInventory`); product create/edit/
 * archive/duplicate are owner/admin (docs/11 §1.3 → `requireRole`).
 */

const NON_STAFF: readonly ("owner" | "admin")[] = ["owner", "admin"];

// ───────────────────────────── shared helpers ─────────────────────────────

/** A media-image draft sent from the client manager — URL paste OR signed upload (FR-13). */
const productImageInputSchema = z.object({
  /** Existing MediaAsset id when re-using a library asset; else a new asset is made. */
  mediaAssetId: z.string().trim().min(1).optional(),
  url: z.string().trim().url("Enter a valid image URL."),
  alt: z.string().trim().max(300).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** Cloudinary public id (set for uploaded images) — enables dedup + cleanup. */
  publicId: z.string().trim().max(255).optional(),
  sizeBytes: z.number().int().positive().optional(),
  isPrimary: z.boolean().default(false),
});
export type ProductImageInput = z.infer<typeof productImageInputSchema>;

/** Full create/update payload = the product fields + media + optimistic guard. */
const createInputSchema = z.object({
  product: z.unknown(),
  images: z.array(productImageInputSchema).max(12, "Up to 12 images per product.").default([]),
});

const updateInputSchema = createInputSchema.extend({
  id: z.string().trim().min(1),
  /** Last-seen `updatedAt` ISO string for optimistic concurrency (FR-68). */
  expectedUpdatedAt: z.string().trim().min(1).optional(),
});

/** Is this slug already used by another product? */
async function slugTakenByOther(slug: string, ignoreId?: string): Promise<boolean> {
  const existing = await prisma.product.findUnique({
    where: { slug },
    select: { id: true },
  });
  return existing !== null && existing.id !== ignoreId;
}

/** Is this SKU already used by another product? */
async function skuTakenByOther(sku: string, ignoreId?: string): Promise<boolean> {
  const existing = await prisma.product.findUnique({
    where: { sku },
    select: { id: true },
  });
  return existing !== null && existing.id !== ignoreId;
}

/**
 * Map the validated input onto the Prisma scalar/array fields shared by create
 * and update. Collections and images are handled separately (relations).
 * `dimensions` is stored as JSON (or cleared with `Prisma.JsonNull`).
 */
function productScalarData(
  input: AdminProductInput,
): Omit<Prisma.ProductUncheckedCreateInput, "slug" | "sku" | "title" | "id"> & {
  slug: string;
  sku: string;
  title: string;
} {
  return {
    slug: input.slug,
    title: input.title,
    subtitle: input.subtitle ?? null,
    description: input.description ?? "",
    shortDescription: input.shortDescription ?? null,
    sku: input.sku,
    price: input.price,
    compareAtPrice: input.compareAtPrice ?? null,
    costPrice: input.costPrice ?? null,
    status: input.status,
    inventoryQuantity: input.inventoryQuantity,
    madeToOrder: input.madeToOrder,
    productionLeadTimeDays: input.productionLeadTimeDays ?? null,
    lowStockThreshold: input.lowStockThreshold,
    allowsPersonalization: input.allowsPersonalization,
    personalizationLabel: input.personalizationLabel ?? null,
    materials: input.materials ?? null,
    careInstructions: input.careInstructions ?? null,
    dimensions: input.dimensions
      ? (input.dimensions as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    weightGrams: input.weightGrams ?? null,
    categoryId: input.categoryId ?? null,
    tags: input.tags,
    occasions: input.occasions,
    isFeatured: input.isFeatured,
    isBestseller: input.isBestseller,
    metaTitle: input.metaTitle ?? null,
    metaDescription: input.metaDescription ?? null,
    ogImageId: input.ogImageId ?? null,
  };
}

/**
 * Reconcile a product's image set inside a transaction (FR-14): create/find a
 * `MediaAsset` per pasted URL, replace the `ProductImage` rows in submitted
 * order (0-based `sortOrder`), and resolve `primaryImageId`. Returns the
 * primaryImageId (a MediaAsset id) to write onto the product, or null.
 */
async function reconcileImages(
  tx: Prisma.TransactionClient,
  productId: string,
  images: ProductImageInput[],
): Promise<string | null> {
  // Replace-the-set: drop existing ProductImage rows, then recreate.
  await tx.productImage.deleteMany({ where: { productId } });

  let primaryMediaAssetId: string | null = null;
  const hasExplicitPrimary = images.some((i) => i.isPrimary);

  for (let index = 0; index < images.length; index++) {
    const img = images[index];

    // Reuse an existing asset, or upsert one keyed by publicId (uploads) / URL
    // (pastes) so the same image submitted twice never spawns duplicate library
    // assets. publicId is the stronger key when present (URLs can carry params).
    let mediaAssetId = img.mediaAssetId ?? null;
    if (!mediaAssetId) {
      const existing = await tx.mediaAsset.findFirst({
        where: img.publicId ? { publicId: img.publicId } : { url: img.url },
        select: { id: true },
      });
      if (existing) {
        mediaAssetId = existing.id;
      } else {
        const created = await tx.mediaAsset.create({
          data: {
            url: img.url,
            alt: img.alt ?? null,
            type: "image",
            width: img.width ?? null,
            height: img.height ?? null,
            sizeBytes: img.sizeBytes ?? null,
            publicId: img.publicId ?? null,
            folder: "products",
          },
          select: { id: true },
        });
        mediaAssetId = created.id;
      }
    }

    // First image is primary by default when none is explicitly flagged.
    const isPrimary = hasExplicitPrimary ? img.isPrimary : index === 0;
    if (isPrimary) primaryMediaAssetId = mediaAssetId;

    await tx.productImage.create({
      data: {
        productId,
        mediaAssetId,
        url: img.url,
        alt: img.alt ?? null,
        width: img.width ?? null,
        height: img.height ?? null,
        sortOrder: index,
        isPrimary,
      },
    });
  }

  return primaryMediaAssetId;
}

/**
 * Bust the cache tags a product write affects (FR-25/26/28). Always `products`;
 * the product slug; its category; each assigned collection; `nav`; and home when
 * featured. Pass the OLD category/collection slugs too so a re-categorize busts
 * both sides (FR-30).
 */
async function revalidateProductWrite(opts: {
  slug: string;
  categoryId: string | null;
  oldCategoryId?: string | null;
  collectionIds: string[];
  oldCollectionIds?: string[];
  isFeatured: boolean;
}): Promise<void> {
  revalidateProduct(opts.slug); // product:{slug} + products

  const categoryIds = new Set<string>();
  if (opts.categoryId) categoryIds.add(opts.categoryId);
  if (opts.oldCategoryId) categoryIds.add(opts.oldCategoryId);
  const collectionIds = new Set<string>([
    ...opts.collectionIds,
    ...(opts.oldCollectionIds ?? []),
  ]);

  if (categoryIds.size > 0) {
    const cats = await prisma.category.findMany({
      where: { id: { in: [...categoryIds] } },
      select: { slug: true },
    });
    for (const c of cats) revalidateCategory(c.slug); // category:{slug} + products + nav
  }
  if (collectionIds.size > 0) {
    const cols = await prisma.collection.findMany({
      where: { id: { in: [...collectionIds] } },
      select: { slug: true },
    });
    for (const c of cols) revalidateCollection(c.slug); // collection:{slug} + products
  }
  if (opts.isFeatured) revalidateHome();

  // The product URL set changed (create/publish/unpublish/archive/delete or a
  // slug change), so refresh the sitemap too (CANON §9 / SEO).
  revalidateSitemap();
}

/** Replace manual collection memberships (CollectionProduct join) for a product. */
async function reconcileCollections(
  tx: Prisma.TransactionClient,
  productId: string,
  collectionIds: string[],
): Promise<void> {
  // Only manual collections are editable per-product (FR-31); automated ones are
  // rule-materialized elsewhere, so we never touch their membership here.
  const manual = await tx.collection.findMany({
    where: { id: { in: collectionIds }, type: "manual" },
    select: { id: true },
  });
  const manualIds = new Set(manual.map((c) => c.id));

  // Remove existing manual memberships, keep automated ones intact.
  const automatedExisting = await tx.collectionProduct.findMany({
    where: { productId, collection: { type: "automated" } },
    select: { collectionId: true },
  });
  const keepAutomated = new Set(automatedExisting.map((c) => c.collectionId));

  await tx.collectionProduct.deleteMany({
    where: { productId, collectionId: { notIn: [...keepAutomated] } },
  });

  if (manualIds.size > 0) {
    await tx.collectionProduct.createMany({
      data: [...manualIds].map((collectionId) => ({ collectionId, productId })),
      skipDuplicates: true,
    });
  }
}

// ───────────────────────────── createProduct ─────────────────────────────

/**
 * Create a product (FR-24/25). Validates with `adminProductInputSchema`,
 * auto-uniquifies the slug, enforces the publish gate when status=active, writes
 * the product + media + manual collections in a transaction, audits, and
 * revalidates (only when active — a draft isn't on the store).
 */
export async function createProduct(
  raw: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const admin = await requireRole(NON_STAFF);

  const outer = createInputSchema.safeParse(raw);
  if (!outer.success) {
    return failValidation(outer.error.flatten().fieldErrors);
  }
  const parsed = adminProductInputSchema.safeParse(outer.data.product);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;
  const images = outer.data.images;

  // Publish gate (FR-4) — needs the image count + category context.
  const gate = publishGateErrors(input, images.length);
  if (gate) {
    return fail("Complete the publish checklist before going live.", gate);
  }

  // SKU uniqueness (friendly error, not a 500 — FR-69).
  if (await skuTakenByOther(input.sku)) {
    return failValidation({ sku: ["That SKU is already in use."] });
  }

  // Slug: auto-suffix collisions (FR-10/69).
  const slug = await uniqueSlug(input.slug || slugify(input.title), (c) =>
    slugTakenByOther(c),
  );
  const data = { ...productScalarData(input), slug };
  const isPublishing = input.status === "active";

  try {
    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...data,
          publishedAt: isPublishing ? new Date() : null,
        },
        select: { id: true, slug: true },
      });

      const primaryMediaAssetId = await reconcileImages(tx, product.id, images);
      await reconcileCollections(tx, product.id, input.collectionIds);

      await tx.product.update({
        where: { id: product.id },
        data: {
          primaryImageId: primaryMediaAssetId,
          // ogImage falls back to primary if not explicitly set.
          ogImageId: input.ogImageId ?? primaryMediaAssetId,
        },
      });

      return product;
    });

    await writeAudit({
      adminId: admin.id,
      action: "product.create",
      entityType: "Product",
      entityId: created.id,
      after: {
        slug: created.slug,
        title: input.title,
        sku: input.sku,
        status: input.status,
        price: input.price,
        categoryId: input.categoryId ?? null,
        imageCount: images.length,
      },
    });

    // Revalidate only when the product is live (a draft isn't on the store).
    if (isPublishing) {
      await revalidateProductWrite({
        slug: created.slug,
        categoryId: input.categoryId ?? null,
        collectionIds: input.collectionIds,
        isFeatured: input.isFeatured,
      });
    }

    return ok({ id: created.id, slug: created.slug });
  } catch (err) {
    return prismaError(err);
  }
}

// ───────────────────────────── updateProduct ─────────────────────────────

/**
 * Update a product (FR-24/25/26). Optimistic concurrency via `expectedUpdatedAt`
 * (FR-68). On a slug change for an already-published product, writes a 301
 * `Redirect` and revalidates the OLD path (FR-10). Enforces the publish gate
 * when status=active. Audits + revalidates the exact affected tags.
 */
export async function updateProduct(raw: unknown): Promise<ActionResult<{ slug: string }>> {
  const admin = await requireRole(NON_STAFF);

  const outer = updateInputSchema.safeParse(raw);
  if (!outer.success) {
    return failValidation(outer.error.flatten().fieldErrors);
  }
  const parsed = adminProductInputSchema.safeParse(outer.data.product);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;
  const images = outer.data.images;
  const { id, expectedUpdatedAt } = outer.data;

  const existing = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      status: true,
      publishedAt: true,
      categoryId: true,
      updatedAt: true,
      isFeatured: true,
      collections: { select: { collectionId: true } },
    },
  });
  if (!existing) return fail("This product no longer exists.");

  // Optimistic concurrency (FR-68 / ST-13).
  if (
    expectedUpdatedAt &&
    new Date(expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()
  ) {
    return fail(
      "This product changed in another tab or session. Reload to get the latest before saving.",
    );
  }

  const gate = publishGateErrors(input, images.length);
  if (gate) {
    return fail("Complete the publish checklist before going live.", gate);
  }

  if (await skuTakenByOther(input.sku, id)) {
    return failValidation({ sku: ["That SKU is already in use."] });
  }

  // Slug handling: published products are immutable-by-default; on an explicit
  // change we 301-redirect the old URL (FR-10/39 / ST-5).
  const wasPublished = existing.publishedAt !== null;
  const requestedSlug = input.slug || slugify(input.title);
  const slugChanged = requestedSlug !== existing.slug;
  const newSlug = slugChanged
    ? await uniqueSlug(requestedSlug, (c) => slugTakenByOther(c, id))
    : existing.slug;

  const isActivatingNow = input.status === "active";
  // Set publishedAt on the FIRST activation only (FR-6); never reset it.
  const setPublishedAt =
    isActivatingNow && existing.publishedAt === null ? new Date() : undefined;

  const data = { ...productScalarData(input), slug: newSlug };

  try {
    await prisma.$transaction(async (tx) => {
      if (slugChanged && wasPublished) {
        // Write a 301 from the old storefront path to the new one (FR-10).
        await tx.redirect.upsert({
          where: { fromPath: `/products/${existing.slug}` },
          update: { toPath: `/products/${newSlug}`, statusCode: 301 },
          create: {
            fromPath: `/products/${existing.slug}`,
            toPath: `/products/${newSlug}`,
            statusCode: 301,
          },
        });
      }

      const primaryMediaAssetId = await reconcileImages(tx, id, images);
      await reconcileCollections(tx, id, input.collectionIds);

      await tx.product.update({
        where: { id },
        data: {
          ...data,
          ...(setPublishedAt ? { publishedAt: setPublishedAt } : {}),
          primaryImageId: primaryMediaAssetId,
          ogImageId: input.ogImageId ?? primaryMediaAssetId,
        },
      });
    });

    await writeAudit({
      adminId: admin.id,
      action: "product.update",
      entityType: "Product",
      entityId: id,
      before: {
        slug: existing.slug,
        status: existing.status,
        categoryId: existing.categoryId,
      },
      after: { slug: newSlug, status: input.status, categoryId: input.categoryId ?? null },
    });

    // Revalidate affected tags only when the product touches the storefront —
    // i.e. it's active now, or was active before this edit (unpublish/edit of a
    // live product). A pure draft→draft edit isn't on the store (FR-24/25/26).
    const touchesStorefront =
      input.status === "active" || existing.status === "active";
    if (touchesStorefront) {
      await revalidateProductWrite({
        slug: newSlug,
        categoryId: input.categoryId ?? null,
        oldCategoryId: existing.categoryId,
        collectionIds: input.collectionIds,
        oldCollectionIds: existing.collections.map((c) => c.collectionId),
        isFeatured: input.isFeatured || existing.isFeatured,
      });
      if (slugChanged && wasPublished) {
        revalidatePath(`/products/${existing.slug}`);
      }
    }

    return ok({ slug: newSlug });
  } catch (err) {
    return prismaError(err);
  }
}

// ───────────────────────────── setProductStatus / archive ─────────────────────────────

const statusActionSchema = z.object({
  id: z.string().trim().min(1),
  status: z.enum(["draft", "active", "archived"]),
});

/**
 * Change a product's status (publish / unpublish / archive / unarchive) without
 * touching other fields (FR-25/26/28). Publishing runs the gate against the
 * product's CURRENT data + image count.
 */
export async function setProductStatus(
  raw: unknown,
): Promise<ActionResult<{ status: ProductStatus }>> {
  const admin = await requireRole(NON_STAFF);

  const parsed = statusActionSchema.safeParse(raw);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const { id, status } = parsed.data;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      status: true,
      price: true,
      sku: true,
      categoryId: true,
      madeToOrder: true,
      productionLeadTimeDays: true,
      publishedAt: true,
      isFeatured: true,
      _count: { select: { images: true } },
      collections: { select: { collectionId: true } },
    },
  });
  if (!product) return fail("This product no longer exists.");

  // Publish gate when activating (FR-4).
  if (status === "active") {
    const errors: string[] = [];
    if (product.price <= 0) errors.push("a price above ₹0");
    if (!product.sku) errors.push("a SKU");
    if (product._count.images < 1) errors.push("at least one image");
    if (!product.categoryId) errors.push("a category");
    if (product.madeToOrder && (product.productionLeadTimeDays ?? 0) < 1)
      errors.push("a production lead time");
    if (errors.length > 0) {
      return fail(`To publish, this product still needs: ${errors.join(", ")}.`);
    }
  }

  const setPublishedAt =
    status === "active" && product.publishedAt === null ? new Date() : undefined;

  await prisma.product.update({
    where: { id },
    data: { status, ...(setPublishedAt ? { publishedAt: setPublishedAt } : {}) },
  });

  const action =
    status === "active"
      ? "product.publish"
      : status === "archived"
        ? "product.archive"
        : "product.unpublish";

  await writeAudit({
    adminId: admin.id,
    action,
    entityType: "Product",
    entityId: id,
    before: { status: product.status },
    after: { status },
  });

  await revalidateProductWrite({
    slug: product.slug,
    categoryId: product.categoryId,
    collectionIds: product.collections.map((c) => c.collectionId),
    isFeatured: product.isFeatured,
  });

  return ok({ status });
}

const idActionSchema = z.object({ id: z.string().trim().min(1) });

/** Archive a product — the "delete" (FR-28). Keeps order history; slug 301s. */
export async function archiveProduct(raw: unknown): Promise<ActionResult<void>> {
  const res = await setProductStatus({ id: (raw as { id?: string })?.id, status: "archived" });
  if (!res.ok) return res;
  return ok(undefined);
}

// ───────────────────────────── duplicateProduct ─────────────────────────────

/**
 * Duplicate a product into a new draft (FR-27): copies all fields except id,
 * slug (→ `{slug}-copy`, unique), sku (blanked → `{sku}-COPY`-style placeholder
 * forced unique), status (→ draft), publishedAt (→ null), feature flags (→
 * false), and inventoryQuantity (→ 0). Images are copied BY REFERENCE (new
 * ProductImage rows pointing at the same MediaAsset). Collections/category/tags
 * copied. Audited; no revalidation (new draft isn't on the store).
 */
export async function duplicateProduct(
  raw: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const admin = await requireRole(NON_STAFF);

  const parsed = idActionSchema.safeParse(raw);
  if (!parsed.success) return fail("Missing product id.");

  const source = await prisma.product.findUnique({
    where: { id: parsed.data.id },
    select: {
      slug: true,
      title: true,
      subtitle: true,
      description: true,
      shortDescription: true,
      sku: true,
      price: true,
      compareAtPrice: true,
      costPrice: true,
      madeToOrder: true,
      productionLeadTimeDays: true,
      lowStockThreshold: true,
      allowsPersonalization: true,
      personalizationLabel: true,
      materials: true,
      careInstructions: true,
      dimensions: true,
      weightGrams: true,
      categoryId: true,
      tags: true,
      occasions: true,
      metaTitle: true,
      metaDescription: true,
      images: {
        select: {
          mediaAssetId: true,
          url: true,
          alt: true,
          width: true,
          height: true,
          sortOrder: true,
          isPrimary: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      collections: {
        select: { collectionId: true, sortOrder: true, collection: { select: { type: true } } },
      },
    },
  });
  if (!source) return fail("This product no longer exists.");

  const newSlug = await uniqueSlug(`${source.slug}-copy`, (c) => slugTakenByOther(c));
  // Blank-ish SKU forced unique (FR-27 / OQ-3): founder must set a real one.
  const skuBase = `${source.sku}-COPY`.slice(0, 60);
  const newSku = await uniqueSlugLikeSku(skuBase);

  try {
    const dup = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          slug: newSlug,
          title: `${source.title} (copy)`,
          subtitle: source.subtitle,
          description: source.description,
          shortDescription: source.shortDescription,
          sku: newSku,
          price: source.price,
          compareAtPrice: source.compareAtPrice,
          costPrice: source.costPrice,
          status: "draft",
          inventoryQuantity: 0,
          madeToOrder: source.madeToOrder,
          productionLeadTimeDays: source.productionLeadTimeDays,
          lowStockThreshold: source.lowStockThreshold,
          allowsPersonalization: source.allowsPersonalization,
          personalizationLabel: source.personalizationLabel,
          materials: source.materials,
          careInstructions: source.careInstructions,
          dimensions:
            source.dimensions === null
              ? Prisma.JsonNull
              : (source.dimensions as Prisma.InputJsonValue),
          weightGrams: source.weightGrams,
          categoryId: source.categoryId,
          tags: source.tags,
          occasions: source.occasions,
          isFeatured: false,
          isBestseller: false,
          metaTitle: source.metaTitle,
          metaDescription: source.metaDescription,
          publishedAt: null,
        },
        select: { id: true, slug: true },
      });

      let primaryMediaAssetId: string | null = null;
      for (const img of source.images) {
        if (img.isPrimary && img.mediaAssetId) primaryMediaAssetId = img.mediaAssetId;
        await tx.productImage.create({
          data: {
            productId: created.id,
            mediaAssetId: img.mediaAssetId, // shared asset by reference
            url: img.url,
            alt: img.alt,
            width: img.width,
            height: img.height,
            sortOrder: img.sortOrder,
            isPrimary: img.isPrimary,
          },
        });
      }
      if (primaryMediaAssetId) {
        await tx.product.update({
          where: { id: created.id },
          data: { primaryImageId: primaryMediaAssetId },
        });
      }

      // Copy ONLY manual memberships (automated are rule-materialized).
      const manual = source.collections.filter((c) => c.collection.type === "manual");
      if (manual.length > 0) {
        await tx.collectionProduct.createMany({
          data: manual.map((c) => ({
            collectionId: c.collectionId,
            productId: created.id,
            sortOrder: c.sortOrder,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    await writeAudit({
      adminId: admin.id,
      action: "product.duplicate",
      entityType: "Product",
      entityId: dup.id,
      after: { slug: dup.slug, sourceId: parsed.data.id },
    });

    return ok({ id: dup.id, slug: dup.slug });
  } catch (err) {
    return prismaError(err);
  }
}

/** Find a unique SKU-like value (`base`, `base-2`, …) honoring the unique key. */
async function uniqueSlugLikeSku(base: string): Promise<string> {
  let candidate = base || "SKU-COPY";
  let n = 2;
  while (await skuTakenByOther(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

// ───────────────────────────── deleteProduct (guarded hard delete) ─────────────────────────────

const deleteSchema = z.object({
  id: z.string().trim().min(1),
  confirmTitle: z.string().trim().min(1),
});

/**
 * Hard-delete a product (FR-29 / ST-17) — allowed ONLY when it has zero
 * `OrderItem`s and the typed `confirmTitle` matches. Otherwise blocked with a
 * nudge to Archive instead. `ProductImage`s cascade; `MediaAsset`s are detached.
 */
export async function deleteProduct(raw: unknown): Promise<ActionResult<void>> {
  const admin = await requireRole(NON_STAFF);

  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) return fail("Type the product title to confirm deletion.");

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      title: true,
      slug: true,
      categoryId: true,
      isFeatured: true,
      _count: { select: { orderItems: true } },
      collections: { select: { collectionId: true } },
    },
  });
  if (!product) return fail("This product no longer exists.");

  if (product._count.orderItems > 0) {
    return fail(
      "This product has order history and can't be deleted. Archive it instead to keep records intact.",
    );
  }
  if (parsed.data.confirmTitle.trim() !== product.title.trim()) {
    return fail("The title you typed doesn't match. Deletion cancelled.");
  }

  await prisma.product.delete({ where: { id: product.id } });

  await writeAudit({
    adminId: admin.id,
    action: "product.delete",
    entityType: "Product",
    entityId: product.id,
    before: { title: product.title, slug: product.slug },
  });

  await revalidateProductWrite({
    slug: product.slug,
    categoryId: product.categoryId,
    collectionIds: product.collections.map((c) => c.collectionId),
    isFeatured: product.isFeatured,
  });

  return ok(undefined);
}

// ───────────────────────────── adjustInventory ─────────────────────────────

const adjustInventorySchema = z.object({
  id: z.string().trim().min(1),
  mode: z.enum(["set", "delta"]).default("set"),
  value: z.number().int(),
  reason: z.enum(ADJUST_REASONS).default("correction"),
  note: z.string().trim().max(500).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  madeToOrder: z.boolean().optional(),
  productionLeadTimeDays: z.number().int().min(1).optional(),
  expectedUpdatedAt: z.string().trim().min(1).optional(),
});

export interface AdjustInventoryResult {
  inventoryQuantity: number;
  lowStockThreshold: number;
  madeToOrder: boolean;
  productionLeadTimeDays: number | null;
  inventoryState: InventoryState;
}

/**
 * Adjust a product's stock (FR-45/46/47). Available to `staff`+ (the one
 * catalog-write surface staff has — docs/11 §1.3). Supports an absolute `set` or
 * a `+/- delta`, plus optional threshold / made-to-order / lead-time edits, all
 * with a required reason. Writes an `AuditLog inventory.adjust` row with
 * before/after qty + reason + delta, and revalidates `product:{slug}` +
 * `products` (FR-48). Optimistic-concurrency guarded (FR-68 / ST-26).
 */
export async function adjustInventory(
  raw: unknown,
): Promise<ActionResult<AdjustInventoryResult>> {
  const admin = await requireAdmin(); // staff+ all allowed

  const parsed = adjustInventorySchema.safeParse(raw);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  const product = await prisma.product.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      slug: true,
      inventoryQuantity: true,
      lowStockThreshold: true,
      madeToOrder: true,
      productionLeadTimeDays: true,
      updatedAt: true,
    },
  });
  if (!product) return fail("This product no longer exists.");

  if (
    input.expectedUpdatedAt &&
    new Date(input.expectedUpdatedAt).getTime() !== product.updatedAt.getTime()
  ) {
    return fail("Stock changed elsewhere. Reload to get the latest, then retry.");
  }

  // Compute the new quantity (clamped at 0; never negative).
  const { quantity: newQty, delta } = resolveAdjustedQuantity(
    product.inventoryQuantity,
    input.mode,
    input.value,
  );

  const newMadeToOrder = input.madeToOrder ?? product.madeToOrder;
  const newLeadTime =
    input.productionLeadTimeDays ?? product.productionLeadTimeDays;
  const newThreshold = input.lowStockThreshold ?? product.lowStockThreshold;

  // If MTO is on (or being turned on), a lead time is required (FR-21).
  if (newMadeToOrder && (newLeadTime ?? 0) < 1) {
    return failValidation({
      productionLeadTimeDays: [
        "Made-to-order products need a production lead time (≥ 1 day).",
      ],
    });
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      inventoryQuantity: newQty,
      lowStockThreshold: newThreshold,
      madeToOrder: newMadeToOrder,
      productionLeadTimeDays: newMadeToOrder ? newLeadTime : product.productionLeadTimeDays,
    },
    select: {
      inventoryQuantity: true,
      lowStockThreshold: true,
      madeToOrder: true,
      productionLeadTimeDays: true,
    },
  });

  await writeAudit({
    adminId: admin.id,
    action: "inventory.adjust",
    entityType: "Product",
    entityId: product.id,
    before: { inventoryQuantity: product.inventoryQuantity },
    after: {
      inventoryQuantity: updated.inventoryQuantity,
      reason: input.reason,
      delta,
      note: input.note ?? null,
    },
  });

  // Stock affects PDP/PLP availability only (FR-48) — not taxonomy tags.
  revalidateProduct(product.slug);

  return ok({
    inventoryQuantity: updated.inventoryQuantity,
    lowStockThreshold: updated.lowStockThreshold,
    madeToOrder: updated.madeToOrder,
    productionLeadTimeDays: updated.productionLeadTimeDays,
    inventoryState: deriveInventoryState(updated),
  });
}

// ───────────────────────────── error mapping ─────────────────────────────

/** Map a Prisma error to a friendly ActionResult (unique-constraint → field). */
function prismaError(err: unknown): ActionResult<never> {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "value";
    if (target.includes("slug")) {
      return failValidation({ slug: ["That URL slug is already in use."] });
    }
    if (target.includes("sku")) {
      return failValidation({ sku: ["That SKU is already in use."] });
    }
    return fail(`A product with that ${target} already exists.`);
  }
  console.error("[products action] unexpected error", err);
  return fail("Something went wrong saving the product. Please try again.");
}
