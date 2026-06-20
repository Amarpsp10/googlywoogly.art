/**
 * Pure order-pricing math. Money is integer **paise** everywhere (CANON §10;
 * `08` FR-30). The server is the source of truth for all totals — this module
 * is the single place where the cart math is defined so the checkout preview and
 * `placeOrder` cannot drift.
 *
 * MVP scope (`08` §3.4, §3.6):
 *  - `subtotal` = Σ(unitPrice × quantity)
 *  - `shippingFee` = 0 when `subtotal >= freeShippingThresholdPaise`, else
 *    `flatRatePaise` (free-over-threshold flat shipping)
 *  - `discountTotal` = 0 (coupons are V1, behind a flag)
 *  - `taxTotal` = 0 (GST is V1, gated on `SiteSetting.gstin`)
 *  - `grandTotal` = subtotal + shippingFee + taxTotal − discountTotal
 *  - an **empty** cart yields all-zero totals (no shipping fee on nothing).
 *
 * PURE: no DB, no `server-only`. The caller passes the resolved
 * `ShippingDefaults` (read from `SiteSetting` server-side).
 */
import type { ShippingDefaults } from "@/types";

/** A priced cart line (server-authoritative unit price, in paise). */
export interface PricedLine {
  /** Unit price in paise. */
  unitPrice: number;
  /** Integer quantity (>= 1 for a real line). */
  quantity: number;
}

/** Fully-computed order money, all fields in integer paise. */
export interface CartTotals {
  subtotal: number;
  shippingFee: number;
  /** Always 0 in MVP (coupons are V1). */
  discountTotal: number;
  /** Always 0 in MVP (GST is V1). */
  taxTotal: number;
  grandTotal: number;
}

/** Sum of line totals (paise). Returns 0 for an empty list. */
export function computeSubtotal(items: ReadonlyArray<PricedLine>): number {
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.unitPrice * item.quantity;
  }
  return subtotal;
}

/**
 * Flat shipping fee with free-over-threshold (paise).
 * Free (0) when `subtotal >= freeShippingThresholdPaise`, otherwise the flat rate.
 * A zero subtotal (empty cart) is treated as "free" — never charge shipping on
 * an empty order.
 */
export function computeShippingFee(
  subtotal: number,
  shipping: ShippingDefaults,
): number {
  if (subtotal <= 0) return 0;
  if (subtotal >= shipping.freeShippingThresholdPaise) return 0;
  return shipping.flatRatePaise;
}

/** True when this subtotal qualifies for free shipping (UI "unlocked" hint). */
export function qualifiesForFreeShipping(
  subtotal: number,
  shipping: ShippingDefaults,
): boolean {
  return subtotal > 0 && subtotal >= shipping.freeShippingThresholdPaise;
}

/** Paise still needed to unlock free shipping (0 once unlocked or empty). */
export function freeShippingRemaining(
  subtotal: number,
  shipping: ShippingDefaults,
): number {
  if (subtotal <= 0) return shipping.freeShippingThresholdPaise;
  return Math.max(0, shipping.freeShippingThresholdPaise - subtotal);
}

/**
 * Compute the full set of order totals for the given cart and shipping config.
 * `discountTotal` and `taxTotal` are fixed at 0 for MVP; `grandTotal` is derived
 * so the relationship `subtotal + shipping + tax − discount` always holds.
 */
export function computeCartTotals(
  items: ReadonlyArray<PricedLine>,
  shipping: ShippingDefaults,
): CartTotals {
  const subtotal = computeSubtotal(items);

  if (subtotal <= 0) {
    return { subtotal: 0, shippingFee: 0, discountTotal: 0, taxTotal: 0, grandTotal: 0 };
  }

  const shippingFee = computeShippingFee(subtotal, shipping);
  const discountTotal = 0;
  const taxTotal = 0;
  const grandTotal = subtotal + shippingFee + taxTotal - discountTotal;

  return { subtotal, shippingFee, discountTotal, taxTotal, grandTotal };
}
