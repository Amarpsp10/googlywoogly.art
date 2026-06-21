import "server-only";

import { Prisma, type ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { deriveInventoryState, type InventoryState } from "@/lib/inventory";

/**
 * Admin **read** services for the product + inventory console (docs/11 §5).
 *
 * Unlike the storefront catalog reads (`@/lib/services/catalog`, which are
 * locked to `status="active"` and strip `costPrice`), these queries see the
 * FULL catalog — drafts, archived, and the admin-only `costPrice`/margin — so
 * the founder can manage everything. They are plain async functions called by
 * RSC pages (NOT Server Actions); pages call `requireAdmin()` first.
 *
 * Money stays integer **paise**; formatting (`formatPaise`) and IST dates happen
 * at the display layer, never here. `inventoryState` is derived at read time
 * (docs/03 FR-12) — never stored.
 */

// ───────────────────────────── product list ─────────────────────────────

const PRODUCTS_PER_PAGE = 25;

/** Filter inputs for the admin product list (`/admin/products`, docs/11 FR-53). */
export interface AdminProductListParams {
  /** Free-text search over title + SKU. */
  q?: string;
  /** Status facet; `undefined`/"all" means every status. */
  status?: ProductStatus | "all";
  page?: number;
}

/** Columns the product list + edit-hydration need (incl. admin-only fields). */
const adminProductListSelect = {
  id: true,
  slug: true,
  title: true,
  sku: true,
  price: true,
  compareAtPrice: true,
  status: true,
  inventoryQuantity: true,
  madeToOrder: true,
  lowStockThreshold: true,
  productionLeadTimeDays: true,
  isFeatured: true,
  isBestseller: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  primaryImage: { select: { url: true } },
  images: {
    select: { url: true },
    orderBy: { sortOrder: "asc" },
    take: 1,
  },
} satisfies Prisma.ProductSelect;

type AdminProductRow = Prisma.ProductGetPayload<{
  select: typeof adminProductListSelect;
}>;

/** A product list row with its derived inventory state + resolved thumbnail. */
export interface AdminProductListItem {
  id: string;
  slug: string;
  title: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  status: ProductStatus;
  inventoryQuantity: number;
  madeToOrder: boolean;
  lowStockThreshold: number;
  productionLeadTimeDays: number | null;
  isFeatured: boolean;
  isBestseller: boolean;
  updatedAt: Date;
  categoryName: string | null;
  thumbnailUrl: string | null;
  inventoryState: InventoryState;
}

function toListItem(p: AdminProductRow): AdminProductListItem {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    sku: p.sku,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    status: p.status,
    inventoryQuantity: p.inventoryQuantity,
    madeToOrder: p.madeToOrder,
    lowStockThreshold: p.lowStockThreshold,
    productionLeadTimeDays: p.productionLeadTimeDays,
    isFeatured: p.isFeatured,
    isBestseller: p.isBestseller,
    updatedAt: p.updatedAt,
    categoryName: p.category?.name ?? null,
    thumbnailUrl: p.primaryImage?.url ?? p.images[0]?.url ?? null,
    inventoryState: deriveInventoryState(p),
  };
}

export interface AdminProductListResult {
  items: AdminProductListItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/**
 * List products for the admin table with search + status filter + pagination
 * (docs/11 FR-52/53). Returns ALL statuses by default (drafts/archived too).
 * Search matches title or SKU case-insensitively.
 */
export async function adminListProducts(
  params: AdminProductListParams = {},
): Promise<AdminProductListResult> {
  const perPage = PRODUCTS_PER_PAGE;
  const page = Math.max(1, Math.floor(params.page ?? 1));

  const where: Prisma.ProductWhereInput = {};
  if (params.status && params.status !== "all") {
    where.status = params.status;
  }
  const q = params.q?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: adminProductListSelect,
      // updatedAt desc, id desc as a deterministic tiebreaker.
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return {
    items: rows.map(toListItem),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

// ───────────────────────────── product edit hydration ─────────────────────────────

/** Full product payload for the edit form (every editable field + media). */
const adminProductDetailSelect = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  description: true,
  shortDescription: true,
  sku: true,
  price: true,
  compareAtPrice: true,
  costPrice: true,
  status: true,
  inventoryQuantity: true,
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
  isFeatured: true,
  isBestseller: true,
  metaTitle: true,
  metaDescription: true,
  ogImageId: true,
  primaryImageId: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  images: {
    select: {
      id: true,
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
    select: { collectionId: true },
  },
} satisfies Prisma.ProductSelect;

export type AdminProductDetail = Prisma.ProductGetPayload<{
  select: typeof adminProductDetailSelect;
}>;

/** Load a single product (any status) for the edit form, or `null` if missing. */
export async function adminGetProductById(
  id: string,
): Promise<AdminProductDetail | null> {
  return prisma.product.findUnique({
    where: { id },
    select: adminProductDetailSelect,
  });
}

// ───────────────────────────── taxonomy options (for pickers) ─────────────────────────────

export interface CategoryOption {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
}

export interface CollectionOption {
  id: string;
  title: string;
  type: "manual" | "automated";
  isActive: boolean;
}

/**
 * All categories + collections for the product-form pickers. Categories are
 * returned sorted parent-first then by `sortOrder` so the form can render the
 * one-level tree (docs/11 FR-30). Collections include `type` so the form can
 * disable manual membership editing for automated ones (docs/11 FR-31).
 */
export async function getProductFormTaxonomy(): Promise<{
  categories: CategoryOption[];
  collections: CollectionOption[];
}> {
  const [categories, collections] = await Promise.all([
    prisma.category.findMany({
      select: { id: true, name: true, parentId: true, isActive: true },
      orderBy: [{ parentId: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.collection.findMany({
      select: { id: true, title: true, type: true, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
  ]);
  return { categories, collections };
}

/** Distinct existing tags across the catalog (for the tag-input autocomplete). */
export async function getDistinctTags(limit = 200): Promise<string[]> {
  // Distinct/sort/limit in Postgres instead of fetching every product's full
  // `tags` array and de-duping in JS — the DB returns only the ≤`limit` strings
  // we actually use, not thousands of rows.
  const rows = await prisma.$queryRaw<{ tag: string }[]>`
    SELECT DISTINCT tag
    FROM "products", unnest("tags") AS tag
    ORDER BY tag
    LIMIT ${limit}
  `;
  return rows.map((r) => r.tag);
}

// ───────────────────────────── inventory view ─────────────────────────────

/** Inventory-view filters (docs/11 FR-44). Mirrors the dashboard deep-links. */
export type InventoryFilter = "all" | "low" | "out" | "in" | "mto";

const inventoryRowSelect = {
  id: true,
  slug: true,
  title: true,
  sku: true,
  status: true,
  inventoryQuantity: true,
  lowStockThreshold: true,
  madeToOrder: true,
  productionLeadTimeDays: true,
  updatedAt: true,
  primaryImage: { select: { url: true } },
  images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
} satisfies Prisma.ProductSelect;

type InventoryRowPayload = Prisma.ProductGetPayload<{
  select: typeof inventoryRowSelect;
}>;

export interface InventoryRow {
  id: string;
  slug: string;
  title: string;
  sku: string;
  status: ProductStatus;
  inventoryQuantity: number;
  lowStockThreshold: number;
  madeToOrder: boolean;
  productionLeadTimeDays: number | null;
  updatedAt: Date;
  thumbnailUrl: string | null;
  inventoryState: InventoryState;
}

export interface InventoryListResult {
  items: InventoryRow[];
  /** Quick counts for the filter chips / footer (over non-archived products). */
  counts: { low: number; out: number };
}

/**
 * List stock for the inventory view (docs/11 FR-43/44). Non-archived products
 * only. The `low`/`out` filters apply the CANON §6 derivation in SQL:
 *  - out  → not MTO AND inventoryQuantity <= 0
 *  - low  → not MTO AND 0 < inventoryQuantity <= lowStockThreshold
 *  - in   → not MTO AND inventoryQuantity > lowStockThreshold
 *  - mto  → madeToOrder = true
 * Made-to-order items are always orderable, so they are excluded from "out".
 *
 * NOTE: the `low`/`in` thresholds compare two columns, which Prisma's typed
 * `where` cannot express, so those branches post-filter the (bounded) result
 * set after deriving state. `out`/`mto`/`all` filter in the query.
 */
export async function adminListInventory(
  params: { q?: string; filter?: InventoryFilter } = {},
): Promise<InventoryListResult> {
  const filter = params.filter ?? "all";

  const baseWhere: Prisma.ProductWhereInput = {
    status: { not: "archived" },
  };
  const q = params.q?.trim();
  if (q) {
    baseWhere.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
    ];
  }

  // Narrow in-query for the filters Prisma can express.
  const where: Prisma.ProductWhereInput = { ...baseWhere };
  if (filter === "mto") {
    where.madeToOrder = true;
  } else if (filter === "out") {
    where.madeToOrder = false;
    where.inventoryQuantity = { lte: 0 };
  } else if (filter === "low" || filter === "in") {
    // Column-vs-column comparison handled post-fetch; still drop MTO here.
    where.madeToOrder = false;
    where.inventoryQuantity = { gt: 0 };
  }

  const [rows, counts] = await Promise.all([
    prisma.product.findMany({
      where,
      select: inventoryRowSelect,
      // Out-of-stock first, then low, then in; then title.
      orderBy: [{ inventoryQuantity: "asc" }, { title: "asc" }],
      take: 500,
    }),
    inventoryCounts(baseWhere),
  ]);

  let items = rows.map(
    (p: InventoryRowPayload): InventoryRow => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      sku: p.sku,
      status: p.status,
      inventoryQuantity: p.inventoryQuantity,
      lowStockThreshold: p.lowStockThreshold,
      madeToOrder: p.madeToOrder,
      productionLeadTimeDays: p.productionLeadTimeDays,
      updatedAt: p.updatedAt,
      thumbnailUrl: p.primaryImage?.url ?? p.images[0]?.url ?? null,
      inventoryState: deriveInventoryState(p),
    }),
  );

  // Post-filter the two column-vs-column branches on derived state.
  if (filter === "low") {
    items = items.filter((p) => p.inventoryState === "low_stock");
  } else if (filter === "in") {
    items = items.filter((p) => p.inventoryState === "in_stock");
  }

  return { items, counts };
}

/**
 * Count low/out-of-stock products (non-MTO) for the chips + dashboard parity
 * (docs/11 FR-44). Out is a single-column compare; low needs the column-vs-column
 * compare, so we count it via a small raw query against the non-archived set.
 */
async function inventoryCounts(
  baseWhere: Prisma.ProductWhereInput,
): Promise<{ low: number; out: number }> {
  const [out, lowRows] = await Promise.all([
    prisma.product.count({
      where: { ...baseWhere, madeToOrder: false, inventoryQuantity: { lte: 0 } },
    }),
    prisma.product.findMany({
      where: { ...baseWhere, madeToOrder: false, inventoryQuantity: { gt: 0 } },
      select: { inventoryQuantity: true, lowStockThreshold: true },
      take: 2000,
    }),
  ]);
  const low = lowRows.filter(
    (r) => r.inventoryQuantity <= r.lowStockThreshold,
  ).length;
  return { low, out };
}

// ───────────────────────────── inventory adjustment history ─────────────────────────────

export interface InventoryAdjustmentEntry {
  id: string;
  createdAt: Date;
  adminName: string;
  before: Prisma.JsonValue;
  after: Prisma.JsonValue;
}

/**
 * The per-product stock adjustment history (docs/11 FR-47): projected from
 * `AuditLog` where `action="inventory.adjust"` for this product. Newest first.
 */
export async function getInventoryAdjustments(
  productId: string,
  limit = 30,
): Promise<InventoryAdjustmentEntry[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      action: "inventory.adjust",
      entityType: "Product",
      entityId: productId,
    },
    select: {
      id: true,
      createdAt: true,
      before: true,
      after: true,
      admin: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    adminName: r.admin?.name ?? "—",
    before: r.before,
    after: r.after,
  }));
}
