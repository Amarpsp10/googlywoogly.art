import { describe, it, expect } from "vitest";
import {
  productFilterParamsSchema,
  parseProductFilters,
  adminProductInputSchema,
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
} from "./catalog";

describe("productFilterParamsSchema — defaults", () => {
  it("applies sane defaults for an empty input", () => {
    const r = parseProductFilters({});
    expect(r).toEqual({
      category: [],
      collection: [],
      occasion: [],
      material: [],
      availability: [],
      tag: [],
      priceMin: undefined,
      priceMax: undefined,
      sort: "featured",
      page: 1,
      perPage: DEFAULT_PER_PAGE,
    });
  });

  it("treats undefined input as empty (never throws)", () => {
    expect(() => parseProductFilters(undefined)).not.toThrow();
    expect(parseProductFilters(undefined).sort).toBe("featured");
  });
});

describe("productFilterParamsSchema — multi-value facets", () => {
  it("splits, lowercases, dedupes and sorts CSV facets", () => {
    const r = parseProductFilters({ category: "Mugs,coasters,mugs" });
    expect(r.category).toEqual(["coasters", "mugs"]);
  });

  it("merges repeated params and commas alike", () => {
    const r = parseProductFilters({ occasion: ["diwali,holi", "Diwali"] });
    expect(r.occasion).toEqual(["diwali", "holi"]);
  });

  it("restricts material to the known namespace", () => {
    const r = parseProductFilters({ material: "wood,unobtanium,brass" });
    expect(r.material).toEqual(["brass", "wood"]);
  });

  it("restricts availability to InventoryState values", () => {
    const r = parseProductFilters({
      availability: "in_stock,teleporting,made_to_order",
    });
    expect(r.availability).toEqual(["in_stock", "made_to_order"]);
  });
});

describe("productFilterParamsSchema — price", () => {
  it("parses combined price=min-max as rupees → paise", () => {
    const r = parseProductFilters({ price: "500-1500" });
    expect(r.priceMin).toBe(50_000);
    expect(r.priceMax).toBe(150_000);
  });

  it("supports open-ended lower bound (500-)", () => {
    const r = parseProductFilters({ price: "500-" });
    expect(r.priceMin).toBe(50_000);
    expect(r.priceMax).toBeUndefined();
  });

  it("supports open-ended upper bound (-1500)", () => {
    const r = parseProductFilters({ price: "-1500" });
    expect(r.priceMin).toBeUndefined();
    expect(r.priceMax).toBe(150_000);
  });

  it("drops inverted ranges (min > max)", () => {
    const r = parseProductFilters({ price: "2000-500" });
    expect(r.priceMin).toBeUndefined();
    expect(r.priceMax).toBeUndefined();
  });

  it("ignores non-numeric / negative price input", () => {
    const r = parseProductFilters({ price: "abc-def" });
    expect(r.priceMin).toBeUndefined();
    expect(r.priceMax).toBeUndefined();
  });

  it("falls back to discrete priceMin/priceMax params", () => {
    const r = parseProductFilters({ priceMin: "750", priceMax: "3000" });
    expect(r.priceMin).toBe(75_000);
    expect(r.priceMax).toBe(300_000);
  });

  it("prefers the combined price param over discrete ones", () => {
    const r = parseProductFilters({
      price: "100-200",
      priceMin: "999",
      priceMax: "9999",
    });
    expect(r.priceMin).toBe(10_000);
    expect(r.priceMax).toBe(20_000);
  });
});

describe("productFilterParamsSchema — sort", () => {
  it("accepts the known sorts", () => {
    for (const s of [
      "featured",
      "newest",
      "price_asc",
      "price_desc",
      "bestselling",
    ]) {
      expect(parseProductFilters({ sort: s }).sort).toBe(s);
    }
  });

  it("falls back to featured for an unknown sort", () => {
    expect(parseProductFilters({ sort: "magic" }).sort).toBe("featured");
  });
});

describe("productFilterParamsSchema — pagination", () => {
  it("defaults page to 1 and clamps invalid pages", () => {
    expect(parseProductFilters({ page: "3" }).page).toBe(3);
    expect(parseProductFilters({ page: "0" }).page).toBe(1);
    expect(parseProductFilters({ page: "-5" }).page).toBe(1);
    expect(parseProductFilters({ page: "abc" }).page).toBe(1);
    expect(parseProductFilters({ page: "2.9" }).page).toBe(2);
  });

  it("defaults perPage and caps it at MAX_PER_PAGE", () => {
    expect(parseProductFilters({}).perPage).toBe(DEFAULT_PER_PAGE);
    expect(parseProductFilters({ perPage: "12" }).perPage).toBe(12);
    expect(parseProductFilters({ perPage: "9999" }).perPage).toBe(MAX_PER_PAGE);
    expect(parseProductFilters({ perPage: "0" }).perPage).toBe(DEFAULT_PER_PAGE);
  });

  it("takes the first value when a scalar param is repeated", () => {
    expect(parseProductFilters({ sort: ["price_asc", "newest"] }).sort).toBe(
      "price_asc",
    );
    expect(parseProductFilters({ page: ["4", "9"] }).page).toBe(4);
  });
});

describe("adminProductInputSchema — happy path", () => {
  const base = {
    title: "Hand-painted Ceramic Diya Set",
    slug: "hand-painted-ceramic-diya-set",
    sku: "GW-DIYA-014",
    price: 149_900,
  };

  it("parses a minimal valid product with defaults", () => {
    const r = adminProductInputSchema.parse(base);
    expect(r.status).toBe("draft");
    expect(r.inventoryQuantity).toBe(0);
    expect(r.lowStockThreshold).toBe(3);
    expect(r.madeToOrder).toBe(false);
    expect(r.tags).toEqual([]);
    expect(r.occasions).toEqual([]);
    expect(r.collectionIds).toEqual([]);
    expect(r.isFeatured).toBe(false);
    expect(r.description).toBe("");
  });

  it("lowercases and dedupes tags but preserves occasion casing", () => {
    const r = adminProductInputSchema.parse({
      ...base,
      tags: ["Brass", "brass", "Diya"],
      occasions: ["Diwali", "Diwali", "Housewarming"],
    });
    expect(r.tags).toEqual(["brass", "diya"]);
    expect(r.occasions).toEqual(["Diwali", "Housewarming"]);
  });

  it("accepts a valid compareAtPrice above price", () => {
    const r = adminProductInputSchema.parse({
      ...base,
      compareAtPrice: 187_500,
    });
    expect(r.compareAtPrice).toBe(187_500);
  });

  it("accepts a made-to-order product with a lead time", () => {
    const r = adminProductInputSchema.parse({
      ...base,
      madeToOrder: true,
      productionLeadTimeDays: 7,
    });
    expect(r.madeToOrder).toBe(true);
    expect(r.productionLeadTimeDays).toBe(7);
  });

  it("accepts dimensions and defaults the unit to cm", () => {
    const r = adminProductInputSchema.parse({
      ...base,
      dimensions: { length: 20, width: 8, height: 8 },
    });
    expect(r.dimensions).toEqual({
      length: 20,
      width: 8,
      height: 8,
      unit: "cm",
    });
  });
});

describe("adminProductInputSchema — validation failures", () => {
  const base = {
    title: "X",
    slug: "x",
    sku: "GW-X",
    price: 100,
  };

  it("requires a non-empty title", () => {
    const r = adminProductInputSchema.safeParse({ ...base, title: "  " });
    expect(r.success).toBe(false);
  });

  it("rejects an empty or non-kebab slug", () => {
    expect(adminProductInputSchema.safeParse({ ...base, slug: "" }).success).toBe(
      false,
    );
    expect(
      adminProductInputSchema.safeParse({ ...base, slug: "Not A Slug" }).success,
    ).toBe(false);
    expect(
      adminProductInputSchema.safeParse({ ...base, slug: "Trailing-" }).success,
    ).toBe(false);
  });

  it("rejects an empty sku", () => {
    expect(adminProductInputSchema.safeParse({ ...base, sku: "" }).success).toBe(
      false,
    );
  });

  it("rejects a negative price", () => {
    expect(
      adminProductInputSchema.safeParse({ ...base, price: -1 }).success,
    ).toBe(false);
  });

  it("allows price = 0 at the base schema (publish-gate is enforced in the action)", () => {
    expect(
      adminProductInputSchema.safeParse({ ...base, price: 0 }).success,
    ).toBe(true);
  });

  it("rejects compareAtPrice <= price", () => {
    const eq = adminProductInputSchema.safeParse({
      ...base,
      price: 1000,
      compareAtPrice: 1000,
    });
    const lt = adminProductInputSchema.safeParse({
      ...base,
      price: 1000,
      compareAtPrice: 900,
    });
    expect(eq.success).toBe(false);
    expect(lt.success).toBe(false);
    if (!lt.success) {
      expect(
        lt.error.issues.some((i) => i.path.includes("compareAtPrice")),
      ).toBe(true);
    }
  });

  it("requires a lead time when madeToOrder is true", () => {
    const r = adminProductInputSchema.safeParse({
      ...base,
      madeToOrder: true,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) => i.path.includes("productionLeadTimeDays")),
      ).toBe(true);
    }
  });

  it("rejects a fractional paise price", () => {
    expect(
      adminProductInputSchema.safeParse({ ...base, price: 100.5 }).success,
    ).toBe(false);
  });
});
