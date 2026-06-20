import { describe, it, expect } from "vitest";
import {
  rankRecommendations,
  scoreRecommendation,
  RECO_WEIGHTS,
  type RecommendationCandidate,
} from "./recommendations.pure";

/**
 * Unit tests for the PURE recommendation ranker (docs/07 FR-38/39/42).
 * No DB / server-only is imported — only the pure scoring module.
 */

function make(
  over: Partial<RecommendationCandidate> & { id: string },
): RecommendationCandidate {
  return {
    categoryId: "cat-a",
    tags: [],
    occasions: [],
    collectionIds: [],
    price: 100_000, // ₹1000 in paise
    isBestseller: false,
    isFeatured: false,
    publishedAt: null,
    madeToOrder: false,
    inventoryQuantity: 10,
    lowStockThreshold: 3,
    ...over,
  };
}

const current = make({
  id: "current",
  categoryId: "cat-a",
  tags: ["brass", "diya", "festive"],
  occasions: ["diwali", "housewarming"],
  collectionIds: ["col-diwali"],
  price: 100_000,
});

describe("scoreRecommendation", () => {
  it("awards the same-category bonus", () => {
    const same = make({ id: "x", categoryId: "cat-a", price: 100_000 });
    const diff = make({ id: "y", categoryId: "cat-b", price: 100_000 });
    expect(scoreRecommendation(current, same)).toBeGreaterThan(
      scoreRecommendation(current, diff),
    );
    // category(50) + priceBand(20) + availability(25) = 95
    expect(scoreRecommendation(current, same)).toBe(95);
  });

  it("does not award same-category when current has no category", () => {
    const noCat = make({ id: "c", categoryId: null, price: 100_000 });
    const cand = make({ id: "x", categoryId: null, price: 100_000 });
    // no category match; priceBand(20) + availability(25) = 45
    expect(scoreRecommendation(noCat, cand)).toBe(45);
  });

  it("scores shared occasions and caps them", () => {
    const base = make({ id: "x", categoryId: "cat-b", price: 1 }); // out of price band
    const one = { ...base, occasions: ["diwali"] };
    const two = { ...base, occasions: ["diwali", "housewarming"] };
    const overlapPlusNoise = {
      ...base,
      occasions: ["diwali", "housewarming", "wedding"],
    };
    // current has only 2 occasions, so max shared = 2 → 30, below the 45 cap.
    expect(scoreRecommendation(current, one)).toBe(
      RECO_WEIGHTS.perOccasion + RECO_WEIGHTS.availabilityBonus,
    );
    expect(scoreRecommendation(current, two)).toBe(
      2 * RECO_WEIGHTS.perOccasion + RECO_WEIGHTS.availabilityBonus,
    );
    expect(scoreRecommendation(current, overlapPlusNoise)).toBe(
      2 * RECO_WEIGHTS.perOccasion + RECO_WEIGHTS.availabilityBonus,
    );
  });

  it("caps tag contribution at the tag cap", () => {
    const manyTags = make({
      id: "x",
      categoryId: "cat-b",
      price: 1,
      tags: ["a", "b", "c", "d", "e", "f"],
    });
    const cur = make({
      id: "cur",
      categoryId: "cat-z",
      tags: ["a", "b", "c", "d", "e", "f"],
      occasions: [],
      collectionIds: [],
    });
    // 6 shared tags * 8 = 48 → capped at 40, + availability 25 = 65
    expect(scoreRecommendation(cur, manyTags)).toBe(
      RECO_WEIGHTS.tagCap + RECO_WEIGHTS.availabilityBonus,
    );
  });

  it("rewards shared collection membership (capped)", () => {
    const cur = make({
      id: "cur",
      categoryId: "cat-z",
      collectionIds: ["c1", "c2", "c3", "c4"],
      price: 100_000,
    });
    const cand = make({
      id: "x",
      categoryId: "cat-y",
      collectionIds: ["c1", "c2", "c3", "c4"],
      price: 1, // out of band to isolate
    });
    // 4 shared * 12 = 48 → capped 36, + availability 25 = 61
    expect(scoreRecommendation(cur, cand)).toBe(
      RECO_WEIGHTS.collectionCap + RECO_WEIGHTS.availabilityBonus,
    );
  });

  it("gives the availability bonus only to orderable items", () => {
    const inStock = make({ id: "in", categoryId: "cat-b", price: 1 });
    const sold = make({
      id: "out",
      categoryId: "cat-b",
      price: 1,
      inventoryQuantity: 0,
    });
    const mto = make({
      id: "mto",
      categoryId: "cat-b",
      price: 1,
      madeToOrder: true,
      inventoryQuantity: 0,
    });
    expect(scoreRecommendation(current, inStock)).toBe(
      RECO_WEIGHTS.availabilityBonus,
    );
    expect(scoreRecommendation(current, mto)).toBe(
      RECO_WEIGHTS.availabilityBonus,
    );
    expect(scoreRecommendation(current, sold)).toBe(0);
  });

  it("adds bestseller and featured flag bonuses", () => {
    const cand = make({
      id: "x",
      categoryId: "cat-b",
      price: 1,
      isBestseller: true,
      isFeatured: true,
    });
    expect(scoreRecommendation(current, cand)).toBe(
      RECO_WEIGHTS.bestseller +
        RECO_WEIGHTS.featured +
        RECO_WEIGHTS.availabilityBonus,
    );
  });

  it("applies the ±35% price band inclusively", () => {
    const inBandLow = make({ id: "lo", categoryId: "cat-b", price: 65_000 }); // exactly -35%
    const inBandHigh = make({ id: "hi", categoryId: "cat-b", price: 135_000 }); // exactly +35%
    const outBand = make({ id: "out", categoryId: "cat-b", price: 200_000 });
    expect(scoreRecommendation(current, inBandLow)).toBe(
      RECO_WEIGHTS.priceBand + RECO_WEIGHTS.availabilityBonus,
    );
    expect(scoreRecommendation(current, inBandHigh)).toBe(
      RECO_WEIGHTS.priceBand + RECO_WEIGHTS.availabilityBonus,
    );
    expect(scoreRecommendation(current, outBand)).toBe(
      RECO_WEIGHTS.availabilityBonus,
    );
  });
});

describe("rankRecommendations", () => {
  it("excludes the current product by id", () => {
    const selfClone = make({ id: "current", categoryId: "cat-a" });
    const other = make({ id: "other", categoryId: "cat-a" });
    const ranked = rankRecommendations(current, [selfClone, other]);
    expect(ranked.map((r) => r.id)).toEqual(["other"]);
  });

  it("ranks higher-similarity products first", () => {
    const strong = make({
      id: "strong",
      categoryId: "cat-a",
      occasions: ["diwali"],
      tags: ["brass"],
      collectionIds: ["col-diwali"],
      price: 100_000,
    });
    const weak = make({ id: "weak", categoryId: "cat-b", price: 500_000 });
    const ranked = rankRecommendations(current, [weak, strong]);
    expect(ranked.map((r) => r.id)).toEqual(["strong", "weak"]);
  });

  it("orders orderable products ahead of sold-out ones at equal score", () => {
    // identical except availability; same score minus the availability bonus
    const sold = make({
      id: "a-sold",
      categoryId: "cat-a",
      price: 100_000,
      inventoryQuantity: 0,
    });
    const stocked = make({
      id: "z-stocked",
      categoryId: "cat-a",
      price: 100_000,
      inventoryQuantity: 5,
    });
    // stocked scores higher purely via the availability bonus → comes first
    const ranked = rankRecommendations(current, [sold, stocked]);
    expect(ranked.map((r) => r.id)).toEqual(["z-stocked", "a-sold"]);
  });

  it("breaks ties deterministically by bestseller, then recency, then id", () => {
    const common = {
      categoryId: "cat-a" as string | null,
      price: 100_000,
      occasions: [] as string[],
      tags: [] as string[],
      collectionIds: [] as string[],
    };
    const older = make({
      ...common,
      id: "b-older",
      publishedAt: "2026-01-01T00:00:00.000Z",
    });
    const newer = make({
      ...common,
      id: "c-newer",
      publishedAt: "2026-06-01T00:00:00.000Z",
    });
    const bestseller = make({
      ...common,
      id: "a-best",
      isBestseller: true,
      publishedAt: "2025-01-01T00:00:00.000Z",
    });
    const ranked = rankRecommendations(current, [older, newer, bestseller]);
    // bestseller wins on flag (despite +10 score it also leads); then newer by date.
    expect(ranked[0].id).toBe("a-best");
    expect(ranked.slice(1).map((r) => r.id)).toEqual(["c-newer", "b-older"]);
  });

  it("is a stable total order for fully-equal candidates (id asc)", () => {
    const mk = (id: string) =>
      make({ id, categoryId: "cat-a", price: 100_000 });
    const input = [mk("d"), mk("a"), mk("c"), mk("b")];
    const ranked = rankRecommendations(current, input);
    expect(ranked.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("respects the limit", () => {
    const cands = Array.from({ length: 20 }, (_, i) =>
      make({ id: `p${String(i).padStart(2, "0")}`, categoryId: "cat-a" }),
    );
    expect(rankRecommendations(current, cands, 4)).toHaveLength(4);
    expect(rankRecommendations(current, cands, 12)).toHaveLength(12);
  });

  it("defaults the limit to 12 and clamps a negative limit to empty", () => {
    const cands = Array.from({ length: 15 }, (_, i) =>
      make({ id: `q${i}`, categoryId: "cat-a" }),
    );
    expect(rankRecommendations(current, cands)).toHaveLength(12);
    expect(rankRecommendations(current, cands, -1)).toHaveLength(0);
  });

  it("returns an empty list when there are no candidates", () => {
    expect(rankRecommendations(current, [])).toEqual([]);
  });
});
