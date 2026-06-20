import { describe, it, expect } from "vitest";
import type { ShippingDefaults } from "@/types";
import {
  computeCartTotals,
  computeSubtotal,
  computeShippingFee,
  qualifiesForFreeShipping,
  freeShippingRemaining,
  type PricedLine,
} from "./pricing";

// Flat ₹49 shipping, free over ₹999 (paise).
const shipping: ShippingDefaults = {
  flatRatePaise: 4900,
  freeShippingThresholdPaise: 99900,
  codEnabled: false,
};

describe("computeSubtotal", () => {
  it("sums unitPrice * quantity across lines", () => {
    const items: PricedLine[] = [
      { unitPrice: 79900, quantity: 2 }, // 159800
      { unitPrice: 129900, quantity: 1 }, // 129900
    ];
    expect(computeSubtotal(items)).toBe(289700);
  });

  it("returns 0 for an empty cart", () => {
    expect(computeSubtotal([])).toBe(0);
  });
});

describe("computeShippingFee (free-over-threshold)", () => {
  it("charges the flat rate below the threshold", () => {
    expect(computeShippingFee(50000, shipping)).toBe(4900);
  });

  it("is free exactly AT the threshold (boundary, >=)", () => {
    expect(computeShippingFee(99900, shipping)).toBe(0);
  });

  it("charges flat rate one paisa below the threshold", () => {
    expect(computeShippingFee(99899, shipping)).toBe(4900);
  });

  it("is free one paisa above the threshold", () => {
    expect(computeShippingFee(99901, shipping)).toBe(0);
  });

  it("never charges shipping on a zero subtotal", () => {
    expect(computeShippingFee(0, shipping)).toBe(0);
  });
});

describe("qualifiesForFreeShipping / freeShippingRemaining", () => {
  it("does not qualify below threshold and reports the remaining gap", () => {
    expect(qualifiesForFreeShipping(50000, shipping)).toBe(false);
    expect(freeShippingRemaining(50000, shipping)).toBe(49900);
  });

  it("qualifies at the threshold with zero remaining", () => {
    expect(qualifiesForFreeShipping(99900, shipping)).toBe(true);
    expect(freeShippingRemaining(99900, shipping)).toBe(0);
  });

  it("an empty cart needs the full threshold and does not qualify", () => {
    expect(qualifiesForFreeShipping(0, shipping)).toBe(false);
    expect(freeShippingRemaining(0, shipping)).toBe(99900);
  });
});

describe("computeCartTotals", () => {
  it("returns all-zero totals for an empty cart", () => {
    expect(computeCartTotals([], shipping)).toEqual({
      subtotal: 0,
      shippingFee: 0,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 0,
    });
  });

  it("adds the flat shipping fee below the threshold", () => {
    const items: PricedLine[] = [{ unitPrice: 50000, quantity: 1 }];
    expect(computeCartTotals(items, shipping)).toEqual({
      subtotal: 50000,
      shippingFee: 4900,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 54900,
    });
  });

  it("gives free shipping at/above the threshold", () => {
    const items: PricedLine[] = [{ unitPrice: 99900, quantity: 1 }];
    expect(computeCartTotals(items, shipping)).toEqual({
      subtotal: 99900,
      shippingFee: 0,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 99900,
    });
  });

  it("keeps the grandTotal invariant (subtotal + ship + tax − discount)", () => {
    const items: PricedLine[] = [
      { unitPrice: 79900, quantity: 2 },
      { unitPrice: 30000, quantity: 1 },
    ];
    const t = computeCartTotals(items, shipping);
    expect(t.subtotal).toBe(189800);
    expect(t.shippingFee).toBe(0); // over ₹999
    expect(t.grandTotal).toBe(
      t.subtotal + t.shippingFee + t.taxTotal - t.discountTotal,
    );
  });

  it("MVP discount and tax are always zero", () => {
    const items: PricedLine[] = [{ unitPrice: 12345, quantity: 3 }];
    const t = computeCartTotals(items, shipping);
    expect(t.discountTotal).toBe(0);
    expect(t.taxTotal).toBe(0);
  });
});
