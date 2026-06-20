import { describe, it, expect } from "vitest";
import {
  categoryInputSchema,
  reorderCategoriesSchema,
  deleteCategorySchema,
} from "./schema";

/**
 * Unit coverage for the category write-schemas (docs/11 §3.14). Pure — no DB.
 * Depth/uniqueness/redirect concerns live in the action (DB context); here we
 * lock the input shaping: required name, optional auto-slug, blank→undefined for
 * optional text, coerced numbers.
 */

describe("categoryInputSchema", () => {
  it("accepts the minimum (just a name) and defaults the rest", () => {
    const parsed = categoryInputSchema.parse({ name: "Diyas & Candles" });
    expect(parsed.name).toBe("Diyas & Candles");
    expect(parsed.slug).toBeUndefined(); // action derives it
    expect(parsed.sortOrder).toBe(0);
    expect(parsed.isActive).toBe(true);
    expect(parsed.parentId).toBeUndefined();
  });

  it("rejects a blank name", () => {
    const res = categoryInputSchema.safeParse({ name: "   " });
    expect(res.success).toBe(false);
  });

  it("turns blank optional text into undefined (not empty string)", () => {
    const parsed = categoryInputSchema.parse({
      name: "Wall Decor",
      description: "   ",
      metaTitle: "",
      metaDescription: "",
    });
    expect(parsed.description).toBeUndefined();
    expect(parsed.metaTitle).toBeUndefined();
    expect(parsed.metaDescription).toBeUndefined();
  });

  it("rejects an invalid (non-kebab) explicit slug", () => {
    const res = categoryInputSchema.safeParse({ name: "X", slug: "Not A Slug" });
    expect(res.success).toBe(false);
  });

  it("accepts a valid kebab slug", () => {
    const parsed = categoryInputSchema.parse({ name: "X", slug: "brass-diyas" });
    expect(parsed.slug).toBe("brass-diyas");
  });

  it("coerces a string sortOrder to an integer", () => {
    const parsed = categoryInputSchema.parse({ name: "X", sortOrder: "4" });
    expect(parsed.sortOrder).toBe(4);
  });

  it("rejects a negative sortOrder", () => {
    const res = categoryInputSchema.safeParse({ name: "X", sortOrder: -1 });
    expect(res.success).toBe(false);
  });
});

describe("reorderCategoriesSchema", () => {
  it("accepts dense orders with optional parentId", () => {
    const parsed = reorderCategoriesSchema.parse({
      orders: [
        { id: "a", sortOrder: 0 },
        { id: "b", sortOrder: 1, parentId: "a" },
        { id: "c", sortOrder: 2, parentId: null },
      ],
    });
    expect(parsed.orders).toHaveLength(3);
    expect(parsed.orders[2].parentId).toBeNull();
  });

  it("rejects an empty orders array", () => {
    expect(reorderCategoriesSchema.safeParse({ orders: [] }).success).toBe(false);
  });
});

describe("deleteCategorySchema", () => {
  it("requires an id and allows an optional reassign target", () => {
    expect(deleteCategorySchema.parse({ id: "x" }).reassignToId).toBeUndefined();
    expect(
      deleteCategorySchema.parse({ id: "x", reassignToId: "y" }).reassignToId,
    ).toBe("y");
  });

  it("rejects a missing id", () => {
    expect(deleteCategorySchema.safeParse({}).success).toBe(false);
  });
});
