import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { deriveInventoryState, type InventoryState } from "@/lib/inventory";
import { productCardSelect, type ProductCard } from "@/lib/services/select";
import {
  rankRecommendations,
  type RecommendationCandidate,
} from "./recommendations.pure";

/**
 * Recommendation services (docs/07 §3.11). The pure, deterministic ranker lives
 * in `./recommendations.pure` (re-exported here for callers); this module adds
 * the DB fetch for the PDP "You may also like" rail and the candidate top-up
 * fallback chain (docs/07 FR-42). Storefront reads are `active`-only and use the
 * shared card select so `costPrice` never leaks.
 */

export {
  rankRecommendations,
  scoreRecommendation,
  type RecommendationCandidate,
} from "./recommendations.pure";

/** A card plus its read-time-derived inventory state (docs/03 FR-12). */
export type ProductCardWithState = ProductCard & {
  inventoryState: InventoryState;
};

/**
 * Candidate select = the card fields plus the extra signals the ranker scores on
 * (`categoryId`, `tags`, `occasions`, active collection memberships).
 */
const recoCandidateSelect = {
  ...productCardSelect,
  categoryId: true,
  tags: true,
  occasions: true,
  publishedAt: true,
  collections: {
    where: { collection: { isActive: true } },
    select: { collectionId: true },
  },
} satisfies Prisma.ProductSelect;

type RecoRow = Prisma.ProductGetPayload<{ select: typeof recoCandidateSelect }>;

/** The seed product shape `getRelatedProducts` needs (a `ProductDetail` satisfies it). */
export interface RecommendationSeed {
  id: string;
  categoryId: string | null;
  tags: string[];
  occasions: string[];
  price: number;
  isBestseller: boolean;
  isFeatured: boolean;
  madeToOrder: boolean;
  inventoryQuantity: number;
  lowStockThreshold: number;
  publishedAt: Date | string | number | null;
  /** Active collection ids the seed belongs to (optional; improves collection scoring). */
  collectionIds?: string[];
}

function rowToCandidate(row: RecoRow): RecommendationCandidate & RecoRow {
  return {
    ...row,
    collectionIds: row.collections.map((c) => c.collectionId),
  };
}

function withState(row: RecoRow): ProductCardWithState {
  const { categoryId, tags, occasions, publishedAt, collections, ...card } =
    row;
  void categoryId;
  void tags;
  void occasions;
  void publishedAt;
  void collections;
  return {
    ...card,
    inventoryState: deriveInventoryState(row),
  };
}

/**
 * "You may also like" — related products for the PDP (docs/07 FR-37/39).
 *
 * Pulls a bounded candidate pool (same category, shared occasions/tags, or
 * shared active collections), ranks it with the pure scorer, then tops up from
 * the global fallback chain (same-category → bestseller → featured → newest;
 * docs/07 FR-42) until `limit` is reached or sources are exhausted. Excludes the
 * seed product and any non-active product. Returns card data with derived
 * `inventoryState` for direct rendering by `<ProductCard>`.
 */
export async function getRelatedProducts(
  product: RecommendationSeed,
  limit = 12,
): Promise<ProductCardWithState[]> {
  if (limit <= 0) return [];

  const seedCollectionIds = product.collectionIds ?? [];
  // Pool fetch cap: enough to rank meaningfully without scanning the catalog.
  const POOL = Math.max(48, limit * 4);

  const baseActive: Prisma.ProductWhereInput = {
    status: "active",
    publishedAt: { lte: new Date() },
    id: { not: product.id },
  };

  // Candidate pool: anything sharing a meaningful signal with the seed.
  const relatednessOr: Prisma.ProductWhereInput[] = [];
  if (product.categoryId) {
    relatednessOr.push({ categoryId: product.categoryId });
  }
  if (product.occasions.length > 0) {
    relatednessOr.push({ occasions: { hasSome: product.occasions } });
  }
  if (product.tags.length > 0) {
    relatednessOr.push({ tags: { hasSome: product.tags } });
  }
  if (seedCollectionIds.length > 0) {
    relatednessOr.push({
      collections: { some: { collectionId: { in: seedCollectionIds } } },
    });
  }

  const seedCandidate: RecommendationCandidate = {
    id: product.id,
    categoryId: product.categoryId,
    tags: product.tags,
    occasions: product.occasions,
    collectionIds: seedCollectionIds,
    price: product.price,
    isBestseller: product.isBestseller,
    isFeatured: product.isFeatured,
    madeToOrder: product.madeToOrder,
    inventoryQuantity: product.inventoryQuantity,
    lowStockThreshold: product.lowStockThreshold,
    publishedAt:
      product.publishedAt instanceof Date
        ? product.publishedAt.toISOString()
        : product.publishedAt,
  };

  const picked: ProductCardWithState[] = [];
  const seen = new Set<string>([product.id]);

  const pushRows = (rows: RecoRow[]) => {
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      picked.push(withState(row));
      if (picked.length >= limit) break;
    }
  };

  // 1) Relatedness pool → pure ranking.
  if (relatednessOr.length > 0) {
    const poolRows = await prisma.product.findMany({
      where: { ...baseActive, OR: relatednessOr },
      select: recoCandidateSelect,
      take: POOL,
    });
    const ranked = rankRecommendations(
      seedCandidate,
      poolRows.map(rowToCandidate),
      limit,
    );
    pushRows(ranked);
  }

  // 2) Global fallback top-up chain (docs/07 FR-42), de-duplicated.
  if (picked.length < limit) {
    const recencyOrder: Prisma.ProductOrderByWithRelationInput[] = [
      { publishedAt: { sort: "desc", nulls: "last" } },
      { id: "asc" },
    ];
    const fallbackScopes: Prisma.ProductWhereInput[] = [
      ...(product.categoryId
        ? [{ ...baseActive, categoryId: product.categoryId }]
        : []),
      { ...baseActive, isBestseller: true },
      { ...baseActive, isFeatured: true },
      { ...baseActive },
    ];

    for (const scope of fallbackScopes) {
      if (picked.length >= limit) break;
      const rows = await prisma.product.findMany({
        // refresh the exclude set each round so earlier picks aren't repeated
        where: { ...scope, id: { notIn: Array.from(seen) } },
        select: recoCandidateSelect,
        orderBy: recencyOrder,
        take: limit - picked.length,
      });
      pushRows(rows);
    }
  }

  return picked.slice(0, limit);
}
