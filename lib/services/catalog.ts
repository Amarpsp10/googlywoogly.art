import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { deriveInventoryState, type InventoryState } from "@/lib/inventory";
import {
  productCardSelect,
  productDetailSelect,
  categorySelect,
  collectionSelect,
  type ProductCard,
  type ProductDetail,
  type CategoryListItem,
  type CollectionListItem,
} from "@/lib/services/select";
import {
  type ProductFilterParams,
  type CatalogSort,
  type AvailabilityValue,
} from "@/lib/validations/catalog";

/**
 * Storefront catalog read services (docs/06, docs/07).
 *
 * Read-only and public: every product read is `status = "active"` AND
 * `publishedAt <= now` and uses the shared card/detail selects so admin-only
 * fields (notably `costPrice`) never leak. Ordering always appends `id ASC` as a
 * deterministic tiebreaker (docs/06 FR-4) so LIMIT/OFFSET pagination never
 * duplicates or drops a row. `inventoryState` is derived at read time on a typed
 * wrapper (docs/03 FR-12) — never selected.
 *
 * These are plain async functions called by RSC pages / sitemaps (not Server
 * Actions); callers wrap them in cached/tagged reads per the CANON §9 matrix.
 */

// ───────────────────────────── derived-state wrappers ─────────────────────────────

export type ProductCardWithState = ProductCard & {
  inventoryState: InventoryState;
};
export type ProductDetailWithState = ProductDetail & {
  inventoryState: InventoryState;
};

function cardWithState<T extends Parameters<typeof deriveInventoryState>[0]>(
  p: ProductCard & T,
): ProductCardWithState {
  return { ...p, inventoryState: deriveInventoryState(p) };
}

/** Paginated grid result (docs/06 FR-22). */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/** A `{ slug, updatedAt }` row for `generateStaticParams` / sitemaps. */
export interface SlugStamp {
  slug: string;
  updatedAt: Date;
}

// ───────────────────────────── shared query building ─────────────────────────────

/** Base predicate: only publicly-visible products (docs/06 §3 "active product"). */
function activeProductWhere(): Prisma.ProductWhereInput {
  return { status: "active", publishedAt: { lte: new Date() } };
}

/** Availability facet → SQL predicate(s), OR'd within the facet (docs/06 FR-10). */
function availabilityWhere(
  values: readonly AvailabilityValue[],
): Prisma.ProductWhereInput | undefined {
  if (values.length === 0) return undefined;
  const threshold = prisma.product.fields.lowStockThreshold;
  const or: Prisma.ProductWhereInput[] = [];
  for (const v of values) {
    switch (v) {
      case "made_to_order":
        or.push({ madeToOrder: true });
        break;
      case "out_of_stock":
        or.push({ madeToOrder: false, inventoryQuantity: { lte: 0 } });
        break;
      case "low_stock":
        or.push({
          madeToOrder: false,
          inventoryQuantity: { gt: 0, lte: threshold },
        });
        break;
      case "in_stock":
        or.push({ madeToOrder: false, inventoryQuantity: { gt: threshold } });
        break;
    }
  }
  return or.length === 1 ? or[0] : { OR: or };
}

/**
 * Translate the validated filter params into a `Prisma.ProductWhereInput[]` of
 * AND-ed conditions (AND across facets, OR within a facet — docs/06 FR-7).
 * The `category`/`collection` URL facets are skipped when `omit` says the
 * surface already scopes to one (category/collection pages).
 */
function filterConditions(
  params: ProductFilterParams,
  omit: { category?: boolean; collection?: boolean } = {},
): Prisma.ProductWhereInput[] {
  const and: Prisma.ProductWhereInput[] = [];

  if (!omit.category && params.category.length > 0) {
    and.push({ category: { slug: { in: params.category } } });
  }
  if (!omit.collection && params.collection.length > 0) {
    and.push({
      collections: {
        some: {
          collection: { slug: { in: params.collection }, isActive: true },
        },
      },
    });
  }
  if (params.occasion.length > 0) {
    and.push({ occasions: { hasSome: params.occasion } });
  }
  if (params.material.length > 0) {
    // Material facet is the curated `material:*` tag namespace (docs/06 FR-9).
    and.push({ tags: { hasSome: params.material.map((m) => `material:${m}`) } });
  }
  if (params.tag.length > 0) {
    and.push({ tags: { hasSome: params.tag } });
  }
  if (params.priceMin !== undefined || params.priceMax !== undefined) {
    const price: Prisma.IntFilter = {};
    if (params.priceMin !== undefined) price.gte = params.priceMin;
    if (params.priceMax !== undefined) price.lte = params.priceMax;
    and.push({ price });
  }
  const avail = availabilityWhere(params.availability);
  if (avail) and.push(avail);

  return and;
}

/** Sort key → Prisma `orderBy` with a deterministic `id ASC` tiebreaker (FR-16). */
function orderByFor(
  sort: CatalogSort,
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }];
    case "price_asc":
      return [{ price: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ price: "desc" }, { id: "asc" }];
    case "bestselling":
      return [
        { isBestseller: "desc" },
        { publishedAt: { sort: "desc", nulls: "last" } },
        { id: "asc" },
      ];
    case "featured":
    default:
      return [
        { isFeatured: "desc" },
        { isBestseller: "desc" },
        { publishedAt: { sort: "desc", nulls: "last" } },
        { id: "asc" },
      ];
  }
}

function totalPages(total: number, perPage: number): number {
  return perPage > 0 ? Math.ceil(total / perPage) : 0;
}

/**
 * Core grid query shared by `/products`, category, and collection surfaces.
 * Applies the AND-ed filter conditions on top of a `baseScope`, paginates with
 * LIMIT/OFFSET, and derives `inventoryState` per row.
 */
async function queryGrid(
  baseScope: Prisma.ProductWhereInput,
  params: ProductFilterParams,
  omit: { category?: boolean; collection?: boolean } = {},
): Promise<Paginated<ProductCardWithState>> {
  const where: Prisma.ProductWhereInput = {
    AND: [baseScope, ...filterConditions(params, omit)],
  };
  const perPage = params.perPage;
  const page = params.page;

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: productCardSelect,
      orderBy: orderByFor(params.sort),
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: rows.map(cardWithState),
    total,
    page,
    perPage,
    totalPages: totalPages(total, perPage),
  };
}

// ───────────────────────────── products (PLP) ─────────────────────────────

/** All-products PLP grid honoring every filter + sort (docs/06 §3). */
export function getProducts(
  params: ProductFilterParams,
): Promise<Paginated<ProductCardWithState>> {
  return queryGrid(activeProductWhere(), params);
}

/** Single active product (full detail) by slug, or null (docs/07 FR-3/4). */
export async function getProductBySlug(
  slug: string,
): Promise<ProductDetailWithState | null> {
  if (!slug) return null;
  const row = await prisma.product.findFirst({
    where: { slug, ...activeProductWhere() },
    select: productDetailSelect,
  });
  if (!row) return null;
  return { ...row, inventoryState: deriveInventoryState(row) };
}

/** Single active product as card data (for rails/related lookups). */
export async function getProductForCard(
  slug: string,
): Promise<ProductCardWithState | null> {
  if (!slug) return null;
  const row = await prisma.product.findFirst({
    where: { slug, ...activeProductWhere() },
    select: productCardSelect,
  });
  return row ? cardWithState(row) : null;
}

// ───────────────────────────── categories ─────────────────────────────

/** A category (header/SEO/scope) by slug, active only (docs/06 §3.7). */
export function getCategoryBySlug(
  slug: string,
): Promise<CategoryListItem | null> {
  if (!slug) return Promise.resolve(null);
  return prisma.category.findFirst({
    where: { slug, isActive: true },
    select: categorySelect,
  });
}

/** Active categories ordered for nav/listing (docs/06 FR-32). */
export function listActiveCategories(): Promise<CategoryListItem[]> {
  return prisma.category.findMany({
    where: { isActive: true },
    select: categorySelect,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/**
 * Category PLP grid (docs/06 FR-30). Scope = the category OR any of its active
 * direct children (one level deep). The `category` URL facet is ignored here
 * (the page scope/chips cover it). Returns null when the category is missing or
 * inactive (caller renders 404).
 */
export async function getProductsByCategory(
  slug: string,
  params: ProductFilterParams,
): Promise<{
  category: CategoryListItem;
  products: Paginated<ProductCardWithState>;
} | null> {
  const category = await prisma.category.findFirst({
    where: { slug, isActive: true },
    select: { ...categorySelect, children: { select: { id: true } } },
  });
  if (!category) return null;

  const childIds = category.children.map((c) => c.id);
  const scope: Prisma.ProductWhereInput = {
    ...activeProductWhere(),
    categoryId: { in: [category.id, ...childIds] },
  };
  const products = await queryGrid(scope, params, { category: true });

  // Re-shape to the public CategoryListItem (drop the children probe).
  const { children, ...categoryItem } = category;
  void children;
  return { category: categoryItem as CategoryListItem, products };
}

// ───────────────────────────── collections ─────────────────────────────

/** A collection (header/SEO/scope) by slug, active only (docs/06 §3.8). */
export function getCollectionBySlug(
  slug: string,
): Promise<CollectionListItem | null> {
  if (!slug) return Promise.resolve(null);
  return prisma.collection.findFirst({
    where: { slug, isActive: true },
    select: collectionSelect,
  });
}

/** Active collections featured on the homepage, ordered (docs/06; CANON §5). */
export function listFeaturedCollections(): Promise<CollectionListItem[]> {
  return prisma.collection.findMany({
    where: { isActive: true, isFeaturedOnHome: true },
    select: collectionSelect,
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
}

/**
 * Collection PLP grid (docs/06 FR-35). Scope = the collection's active products
 * via `CollectionProduct`. With the default `featured` sort, manual collections
 * lead with the founder's hand-ordering (`CollectionProduct.sortOrder`,
 * docs/06 FR-17) — applied here for page 1; any explicit sort overrides it.
 * Returns null when the collection is missing or inactive.
 */
export async function getCollectionProducts(
  slug: string,
  params: ProductFilterParams,
): Promise<{
  collection: CollectionListItem;
  products: Paginated<ProductCardWithState>;
} | null> {
  const collection = await prisma.collection.findFirst({
    where: { slug, isActive: true },
    select: { ...collectionSelect, type: true },
  });
  if (!collection) return null;

  const scope: Prisma.ProductWhereInput = {
    ...activeProductWhere(),
    collections: { some: { collectionId: collection.id } },
  };

  let products: Paginated<ProductCardWithState>;
  if (collection.type === "manual" && params.sort === "featured") {
    // Honor the merchandised CollectionProduct.sortOrder for manual collections.
    const where: Prisma.ProductWhereInput = {
      AND: [scope, ...filterConditions(params, { collection: true })],
    };
    const perPage = params.perPage;
    const page = params.page;
    const [memberships, total] = await Promise.all([
      prisma.collectionProduct.findMany({
        where: {
          collectionId: collection.id,
          product: {
            AND: [activeProductWhere(), ...filterConditions(params, { collection: true })],
          },
        },
        select: { product: { select: productCardSelect } },
        orderBy: [{ sortOrder: "asc" }, { productId: "asc" }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.product.count({ where }),
    ]);
    products = {
      items: memberships.map((m) => cardWithState(m.product)),
      total,
      page,
      perPage,
      totalPages: totalPages(total, perPage),
    };
  } else {
    products = await queryGrid(scope, params, { collection: true });
  }

  const { type, ...collectionItem } = collection;
  void type;
  return { collection: collectionItem as CollectionListItem, products };
}

// ───────────────────────────── home rails ─────────────────────────────

/** Featured products for homepage rails (docs/05; CANON §5). */
export async function getFeaturedProducts(
  limit = 12,
): Promise<ProductCardWithState[]> {
  const rows = await prisma.product.findMany({
    where: { ...activeProductWhere(), isFeatured: true },
    select: productCardSelect,
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    take: Math.max(0, limit),
  });
  return rows.map(cardWithState);
}

/** Bestsellers: flagged bestsellers first, then most recent (docs/06 FR-18). */
export async function getBestsellers(
  limit = 12,
): Promise<ProductCardWithState[]> {
  const rows = await prisma.product.findMany({
    where: { ...activeProductWhere(), isBestseller: true },
    select: productCardSelect,
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    take: Math.max(0, limit),
  });
  return rows.map(cardWithState);
}

// ───────────────────────────── search ─────────────────────────────

/**
 * Search the catalog with Postgres case-insensitive `contains` over
 * title/subtitle/shortDescription, plus an exact tag/occasion match
 * (docs/06 §3.9, FR-38). Safe against an empty query: a blank `q` returns an
 * empty page (the page renders the search landing). Honors the same sort/page
 * params; the default `featured` order applies (relevance ranking via FTS is a
 * raw-SQL fast-follow — see open questions).
 */
export async function searchProducts(
  query: string,
  params: ProductFilterParams,
): Promise<Paginated<ProductCardWithState>> {
  const q = (query ?? "").trim().slice(0, 80);
  if (q.length === 0) {
    return {
      items: [],
      total: 0,
      page: params.page,
      perPage: params.perPage,
      totalPages: 0,
    };
  }

  const insensitive = Prisma.QueryMode.insensitive;
  const matchOr: Prisma.ProductWhereInput[] = [
    { title: { contains: q, mode: insensitive } },
    { subtitle: { contains: q, mode: insensitive } },
    { shortDescription: { contains: q, mode: insensitive } },
    { tags: { has: q.toLowerCase() } },
    { occasions: { has: q } },
  ];

  const scope: Prisma.ProductWhereInput = {
    ...activeProductWhere(),
    OR: matchOr,
  };
  return queryGrid(scope, params);
}

// ───────────────────────────── static params / sitemaps ─────────────────────────────

/** Active product slugs + timestamps for `generateStaticParams` / sitemap. */
export function getAllActiveProductSlugs(): Promise<SlugStamp[]> {
  return prisma.product.findMany({
    where: activeProductWhere(),
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
}

/** Active category slugs + timestamps for `generateStaticParams` / sitemap. */
export function getAllActiveCategorySlugs(): Promise<SlugStamp[]> {
  return prisma.category.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
}

/** Active collection slugs + timestamps for `generateStaticParams` / sitemap. */
export function getAllActiveCollectionSlugs(): Promise<SlugStamp[]> {
  return prisma.collection.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
}
