/**
 * PURE catalog write-rules (no DB, no `server-only`) shared by the product +
 * inventory Server Actions (docs/11) and unit-tested in isolation. Keeping these
 * here means the publish gate (FR-4) and the inventory math (FR-45/46) have one
 * authoritative implementation that tests can exercise without a database.
 */

/** The minimal product shape the publish gate inspects. */
export interface PublishGateInput {
  status: "draft" | "active" | "archived";
  price: number; // paise
  sku: string;
  categoryId?: string | null;
  madeToOrder: boolean;
  productionLeadTimeDays?: number | null;
}

/**
 * Compute publish-checklist field errors (FR-4). Returns `null` when the product
 * may publish (or isn't being set active). To go `active` a product needs:
 * `price > 0`, a non-empty `sku`, ≥1 image, a `categoryId`, and — when
 * made-to-order — a `productionLeadTimeDays ≥ 1`. The image count is passed in
 * because the pure rule has no media context.
 */
export function publishGateErrors(
  input: PublishGateInput,
  imageCount: number,
): Record<string, string[]> | null {
  if (input.status !== "active") return null;
  const errors: Record<string, string[]> = {};
  if (input.price <= 0) {
    errors.price = ["Set a price above ₹0 to publish."];
  }
  if (!input.sku || input.sku.trim().length === 0) {
    errors.sku = ["A SKU is required to publish."];
  }
  if (imageCount < 1) {
    errors.images = ["Add at least one image to publish."];
  }
  if (!input.categoryId) {
    errors.categoryId = ["Choose a category to publish."];
  }
  if (input.madeToOrder && (input.productionLeadTimeDays ?? 0) < 1) {
    errors.productionLeadTimeDays = [
      "Made-to-order products need a production lead time to publish.",
    ];
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * Resolve the new on-hand quantity for a stock adjustment (FR-45/46): an
 * absolute `set` or a `+/- delta`, always clamped at 0 (never negative).
 */
export function resolveAdjustedQuantity(
  currentQty: number,
  mode: "set" | "delta",
  value: number,
): { quantity: number; delta: number } {
  const quantity =
    mode === "set"
      ? Math.max(0, Math.trunc(value))
      : Math.max(0, currentQty + Math.trunc(value));
  return { quantity, delta: quantity - currentQty };
}

/**
 * Inventory-adjustment reasons (docs/11 FR-46). Lives here (not in the
 * `"use server"` actions file, which may export only async functions) so both
 * the action's Zod enum and the client inventory editor can import it.
 */
export const ADJUST_REASONS = [
  "recount",
  "received_stock",
  "damaged",
  "lost",
  "returned_to_stock",
  "correction",
  "sold_offline",
  "other",
] as const;
export type AdjustReason = (typeof ADJUST_REASONS)[number];
