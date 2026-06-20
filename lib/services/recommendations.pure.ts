import { deriveInventoryState, type InventoryInput } from "@/lib/inventory";

/**
 * PURE recommendation ranking (no DB, no `server-only`) — the deterministic
 * scoring + ordering behind the PDP "You may also like" rail (docs/07 FR-38/39/42).
 *
 * Kept in its own module (imported by the server-only `recommendations.ts` AND by
 * the unit test) so the ranking logic is testable without pulling in Prisma /
 * `server-only`, per the project rule "keep pure logic separate from DB access".
 */

/** Minimal product signal the ranker needs. A superset of card fields. */
export interface RecommendationCandidate extends InventoryInput {
  id: string;
  /** Taxonomy parent id (CANON `Product.categoryId`). */
  categoryId: string | null;
  tags: string[];
  occasions: string[];
  /** Ids of (active) collections this product belongs to. */
  collectionIds: string[];
  price: number; // paise
  isBestseller: boolean;
  isFeatured: boolean;
  /** ISO string or epoch ms; drives the recency tiebreaker. May be null. */
  publishedAt: string | number | Date | null;
}

/** Scoring weights for "You may also like" (docs/07 FR-39). Exported for testing. */
export const RECO_WEIGHTS = {
  sameCategory: 50,
  perOccasion: 15,
  occasionCap: 45,
  perTag: 8,
  tagCap: 40,
  perCollection: 12,
  collectionCap: 36,
  priceBand: 20,
  bestseller: 10,
  featured: 8,
  availabilityBonus: 25,
} as const;

/** ±35% price band around the current product (docs/07 FR-39). */
const PRICE_BAND = 0.35;

/** Availability tier for ordering: orderable (in/low/MTO) ahead of sold-out. */
function availabilityTier(c: InventoryInput): 0 | 1 {
  return deriveInventoryState(c) === "out_of_stock" ? 1 : 0;
}

function publishedMs(
  v: string | number | Date | null | undefined,
): number {
  if (v === null || v === undefined) return 0;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function countShared(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const set = new Set(b);
  let n = 0;
  for (const x of a) if (set.has(x)) n++;
  return n;
}

/**
 * Similarity score of `candidate` to `current` (docs/07 FR-39). Pure, deterministic.
 * Availability bonus keeps orderable items ahead; sold-out items still score but
 * lose the +25 so they rank last among otherwise-equal candidates.
 */
export function scoreRecommendation(
  current: RecommendationCandidate,
  candidate: RecommendationCandidate,
): number {
  let score = 0;

  if (
    current.categoryId !== null &&
    candidate.categoryId === current.categoryId
  ) {
    score += RECO_WEIGHTS.sameCategory;
  }

  score += Math.min(
    RECO_WEIGHTS.occasionCap,
    countShared(candidate.occasions, current.occasions) *
      RECO_WEIGHTS.perOccasion,
  );

  score += Math.min(
    RECO_WEIGHTS.tagCap,
    countShared(candidate.tags, current.tags) * RECO_WEIGHTS.perTag,
  );

  score += Math.min(
    RECO_WEIGHTS.collectionCap,
    countShared(candidate.collectionIds, current.collectionIds) *
      RECO_WEIGHTS.perCollection,
  );

  // Same price band (±35% of current price).
  const lo = current.price * (1 - PRICE_BAND);
  const hi = current.price * (1 + PRICE_BAND);
  if (candidate.price >= lo && candidate.price <= hi) {
    score += RECO_WEIGHTS.priceBand;
  }

  if (candidate.isBestseller) score += RECO_WEIGHTS.bestseller;
  if (candidate.isFeatured) score += RECO_WEIGHTS.featured;

  if (availabilityTier(candidate) === 0) {
    score += RECO_WEIGHTS.availabilityBonus;
  }

  return score;
}

/**
 * Rank related products for the "You may also like" rail (docs/07 FR-38/39/42):
 *  - excludes the current product (by id),
 *  - scores by category/occasion/tag/collection/price/flags similarity,
 *  - orders by: score desc → availability tier (orderable first) →
 *    isBestseller desc → newer publishedAt → id asc (stable),
 *  - returns at most `limit` candidates.
 *
 * Deterministic and stable: equal candidates keep a total order via the `id`
 * tiebreaker, so the same inputs always yield the same output.
 */
export function rankRecommendations<T extends RecommendationCandidate>(
  current: RecommendationCandidate,
  candidates: readonly T[],
  limit = 12,
): T[] {
  const scored = candidates
    .filter((c) => c.id !== current.id)
    .map((c) => ({
      c,
      score: scoreRecommendation(current, c),
      tier: availabilityTier(c),
      published: publishedMs(c.publishedAt),
    }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.tier !== b.tier) return a.tier - b.tier; // 0 (orderable) before 1
    if (a.c.isBestseller !== b.c.isBestseller) {
      return a.c.isBestseller ? -1 : 1;
    }
    if (b.published !== a.published) return b.published - a.published;
    return a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0;
  });

  const capped = limit < 0 ? 0 : limit;
  return scored.slice(0, capped).map((s) => s.c);
}
