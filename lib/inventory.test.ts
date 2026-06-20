import { describe, it, expect } from "vitest";
import {
  deriveInventoryState,
  isOrderable,
  purchasableQuantity,
} from "./inventory";

const base = { madeToOrder: false, inventoryQuantity: 10, lowStockThreshold: 3 };

describe("deriveInventoryState", () => {
  it("made-to-order overrides stock", () => {
    expect(deriveInventoryState({ ...base, madeToOrder: true, inventoryQuantity: 0 })).toBe(
      "made_to_order",
    );
  });
  it("out of stock at zero/negative", () => {
    expect(deriveInventoryState({ ...base, inventoryQuantity: 0 })).toBe("out_of_stock");
  });
  it("low stock at/below threshold", () => {
    expect(deriveInventoryState({ ...base, inventoryQuantity: 3 })).toBe("low_stock");
    expect(deriveInventoryState({ ...base, inventoryQuantity: 1 })).toBe("low_stock");
  });
  it("in stock above threshold", () => {
    expect(deriveInventoryState(base)).toBe("in_stock");
  });
});

describe("orderability", () => {
  it("out_of_stock is not orderable; others are", () => {
    expect(isOrderable("out_of_stock")).toBe(false);
    expect(isOrderable("made_to_order")).toBe(true);
    expect(isOrderable("low_stock")).toBe(true);
  });
  it("purchasable quantity caps to stock unless made-to-order", () => {
    expect(purchasableQuantity({ ...base, inventoryQuantity: 5 })).toBe(5);
    expect(purchasableQuantity({ ...base, inventoryQuantity: 0 })).toBe(0);
    expect(purchasableQuantity({ ...base, madeToOrder: true, inventoryQuantity: 0 })).toBe(99);
  });
});
