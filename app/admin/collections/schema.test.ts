import { describe, it, expect } from "vitest";
import { CollectionType } from "@prisma/client";
import {
  collectionInputSchema,
  setCollectionProductsSchema,
  reorderCollectionsSchema,
  collectionRulesSchema,
} from "./schema";

/**
 * Unit coverage for the collection write-schemas (docs/11 §3.10/§3.15). Pure — no
 * DB. Locks input shaping + the automated-rules requirement; membership/redirect
 * concerns live in the action.
 */

describe("collectionInputSchema", () => {
  it("accepts a minimal manual collection and defaults the rest", () => {
    const parsed = collectionInputSchema.parse({ title: "Diwali Gifts" });
    expect(parsed.type).toBe(CollectionType.manual);
    expect(parsed.slug).toBeUndefined();
    expect(parsed.isActive).toBe(true);
    expect(parsed.isFeaturedOnHome).toBe(false);
    expect(parsed.sortOrder).toBe(0);
  });

  it("rejects a blank title", () => {
    expect(collectionInputSchema.safeParse({ title: "  " }).success).toBe(false);
  });

  it("requires at least one rule for an automated collection", () => {
    const res = collectionInputSchema.safeParse({
      title: "Under 999",
      type: CollectionType.automated,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const issue = res.error.issues.find((i) => i.path.includes("rules"));
      expect(issue).toBeTruthy();
    }
  });

  it("accepts an automated collection with a rule", () => {
    const parsed = collectionInputSchema.parse({
      title: "Under 999",
      type: CollectionType.automated,
      rules: { match: "all", conditions: [{ field: "price", op: "lte", value: 99900 }] },
    });
    expect(parsed.type).toBe(CollectionType.automated);
    expect(parsed.rules?.conditions).toHaveLength(1);
  });

  it("turns blank optional text into undefined", () => {
    const parsed = collectionInputSchema.parse({
      title: "X",
      description: "  ",
      metaTitle: "",
    });
    expect(parsed.description).toBeUndefined();
    expect(parsed.metaTitle).toBeUndefined();
  });
});

describe("collectionRulesSchema", () => {
  it("defaults match to 'all' and conditions to []", () => {
    const parsed = collectionRulesSchema.parse({});
    expect(parsed.match).toBe("all");
    expect(parsed.conditions).toEqual([]);
  });

  it("accepts each value kind (string, number, boolean, string[])", () => {
    const parsed = collectionRulesSchema.parse({
      match: "any",
      conditions: [
        { field: "tag", op: "eq", value: "diwali" },
        { field: "price", op: "gte", value: 50000 },
        { field: "isBestseller", op: "eq", value: true },
        { field: "occasion", op: "in", value: ["Diwali", "Wedding"] },
      ],
    });
    expect(parsed.conditions).toHaveLength(4);
  });

  it("rejects an unknown field", () => {
    const res = collectionRulesSchema.safeParse({
      conditions: [{ field: "color", op: "eq", value: "red" }],
    });
    expect(res.success).toBe(false);
  });
});

describe("setCollectionProductsSchema", () => {
  it("accepts an empty member set (clearing the collection)", () => {
    const parsed = setCollectionProductsSchema.parse({ collectionId: "c", items: [] });
    expect(parsed.items).toEqual([]);
  });

  it("coerces sortOrder and keeps productId", () => {
    const parsed = setCollectionProductsSchema.parse({
      collectionId: "c",
      items: [{ productId: "p1", sortOrder: "2" }],
    });
    expect(parsed.items[0].sortOrder).toBe(2);
  });

  it("rejects a missing collectionId", () => {
    expect(setCollectionProductsSchema.safeParse({ items: [] }).success).toBe(false);
  });
});

describe("reorderCollectionsSchema", () => {
  it("accepts a non-empty orders list", () => {
    const parsed = reorderCollectionsSchema.parse({
      orders: [{ id: "a", sortOrder: 0 }],
    });
    expect(parsed.orders).toHaveLength(1);
  });

  it("rejects an empty list", () => {
    expect(reorderCollectionsSchema.safeParse({ orders: [] }).success).toBe(false);
  });
});
