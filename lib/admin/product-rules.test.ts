import { describe, it, expect } from "vitest";
import {
  publishGateErrors,
  resolveAdjustedQuantity,
  type PublishGateInput,
} from "./product-rules";

/**
 * Pure unit tests for the catalog write-rules (docs/11 FR-4/45/46). No DB —
 * these helpers are the single source of truth the Server Actions import.
 */

const activeBase: PublishGateInput = {
  status: "active",
  price: 149_900,
  sku: "GW-DIYA-014",
  categoryId: "cat_123",
  madeToOrder: false,
  productionLeadTimeDays: null,
};

describe("publishGateErrors", () => {
  it("returns null when not publishing (drafts can be incomplete)", () => {
    expect(
      publishGateErrors({ ...activeBase, status: "draft", price: 0, sku: "" }, 0),
    ).toBeNull();
    expect(
      publishGateErrors({ ...activeBase, status: "archived", price: 0, sku: "" }, 0),
    ).toBeNull();
  });

  it("passes a complete active product with ≥1 image", () => {
    expect(publishGateErrors(activeBase, 1)).toBeNull();
  });

  it("requires price > 0 to publish", () => {
    const errors = publishGateErrors({ ...activeBase, price: 0 }, 1);
    expect(errors).not.toBeNull();
    expect(errors?.price).toBeDefined();
  });

  it("requires a non-empty SKU to publish", () => {
    expect(publishGateErrors({ ...activeBase, sku: "" }, 1)?.sku).toBeDefined();
    expect(publishGateErrors({ ...activeBase, sku: "   " }, 1)?.sku).toBeDefined();
  });

  it("requires at least one image to publish", () => {
    expect(publishGateErrors(activeBase, 0)?.images).toBeDefined();
    expect(publishGateErrors(activeBase, 1)?.images).toBeUndefined();
  });

  it("requires a category to publish", () => {
    expect(publishGateErrors({ ...activeBase, categoryId: null }, 1)?.categoryId).toBeDefined();
    expect(publishGateErrors({ ...activeBase, categoryId: undefined }, 1)?.categoryId).toBeDefined();
  });

  it("requires a lead time when made-to-order", () => {
    const errors = publishGateErrors(
      { ...activeBase, madeToOrder: true, productionLeadTimeDays: null },
      1,
    );
    expect(errors?.productionLeadTimeDays).toBeDefined();

    const ok = publishGateErrors(
      { ...activeBase, madeToOrder: true, productionLeadTimeDays: 7 },
      1,
    );
    expect(ok).toBeNull();
  });

  it("collects multiple missing items at once", () => {
    const errors = publishGateErrors(
      { ...activeBase, price: 0, sku: "", categoryId: null },
      0,
    );
    expect(errors).not.toBeNull();
    expect(Object.keys(errors ?? {})).toEqual(
      expect.arrayContaining(["price", "sku", "images", "categoryId"]),
    );
  });
});

describe("resolveAdjustedQuantity", () => {
  it("sets an absolute quantity", () => {
    expect(resolveAdjustedQuantity(2, "set", 5)).toEqual({ quantity: 5, delta: 3 });
  });

  it("applies a positive delta", () => {
    expect(resolveAdjustedQuantity(2, "delta", 3)).toEqual({ quantity: 5, delta: 3 });
  });

  it("applies a negative delta", () => {
    expect(resolveAdjustedQuantity(5, "delta", -2)).toEqual({ quantity: 3, delta: -2 });
  });

  it("clamps at zero on a set", () => {
    expect(resolveAdjustedQuantity(5, "set", -10)).toEqual({ quantity: 0, delta: -5 });
  });

  it("clamps at zero on an over-subtracting delta", () => {
    expect(resolveAdjustedQuantity(2, "delta", -10)).toEqual({ quantity: 0, delta: -2 });
  });

  it("truncates fractional inputs to whole units", () => {
    expect(resolveAdjustedQuantity(0, "set", 4.9)).toEqual({ quantity: 4, delta: 4 });
    expect(resolveAdjustedQuantity(10, "delta", 2.7)).toEqual({ quantity: 12, delta: 2 });
  });
});
