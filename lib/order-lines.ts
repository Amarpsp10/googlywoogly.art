import type { CheckoutInput } from "@/lib/validations/checkout";
import type { PricedLine } from "@/lib/services/pricing";

/**
 * Pure order-line construction extracted from the `placeOrder` Server Action.
 * Lives in a normal module (no `"use server"`, no `server-only`) so it can be
 * unit-tested without a DB and so the action file exports only async functions.
 * No DB, no I/O.
 */

export const SOLD_OUT_ERROR =
  "Sorry, some items just sold out — please adjust your cart.";
export const UNAVAILABLE_ERROR =
  "Some items in your cart are no longer available — please review your cart.";

/**
 * The authoritative, storefront-safe product snapshot `placeOrder` reads inside
 * the transaction. Kept as a plain interface (not a Prisma payload type) so the
 * pure builder below is unit-testable without a DB. `costPrice` is intentionally
 * absent — it is admin-only and never selected for the storefront.
 */
export interface OrderProductSnapshot {
  id: string;
  /** Server-authoritative unit price, paise. */
  price: number;
  sku: string;
  title: string;
  inventoryQuantity: number;
  madeToOrder: boolean;
  productionLeadTimeDays: number | null;
  /** Primary image URL snapshot (or null when none). */
  primaryImageUrl: string | null;
}

/** A frozen `OrderItem` create-payload (paise). */
export interface OrderLineSnapshot {
  productId: string;
  productTitle: string;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  personalizationNote: string | null;
  giftMessage: string | null;
  madeToOrderSnapshot: boolean;
  productionLeadTimeDaysSnapshot: number | null;
}

/** Outcome of building order lines from validated cart items + product snapshots. */
export type BuildOrderLinesResult =
  | { ok: true; lines: OrderLineSnapshot[]; pricedLines: PricedLine[] }
  | { ok: false; error: string };

/**
 * Build frozen `OrderItem` snapshots from the validated cart `items[]` and a map
 * of authoritative product snapshots (keyed by id). PURE — no DB, no I/O.
 *
 * Rules:
 *  - a referenced product missing from the map ⇒ unavailable (archived/draft/
 *    deleted) → `UNAVAILABLE_ERROR`;
 *  - non-made-to-order lines require `inventoryQuantity >= quantity`, else
 *    `SOLD_OUT_ERROR` (made-to-order lines skip the stock check);
 *  - `unitPrice` is taken from the server's `product.price` (client value ignored);
 *    `lineTotal = unitPrice × quantity`.
 */
export function buildOrderLines(
  items: CheckoutInput["items"],
  productsById: ReadonlyMap<string, OrderProductSnapshot>,
): BuildOrderLinesResult {
  const lines: OrderLineSnapshot[] = [];
  const pricedLines: PricedLine[] = [];

  for (const item of items) {
    const product = productsById.get(item.productId);
    // Missing ⇒ not active / archived / deleted between add and submit.
    if (!product) {
      return { ok: false, error: UNAVAILABLE_ERROR };
    }

    // Stock guard for physical (non-MTO) goods only; MTO is always orderable.
    if (!product.madeToOrder && product.inventoryQuantity < item.quantity) {
      return { ok: false, error: SOLD_OUT_ERROR };
    }

    const unitPrice = product.price; // authoritative — never the client's.
    const quantity = item.quantity;
    const lineTotal = unitPrice * quantity;

    lines.push({
      productId: product.id,
      productTitle: product.title,
      sku: product.sku,
      imageUrl: product.primaryImageUrl,
      unitPrice,
      quantity,
      lineTotal,
      personalizationNote: item.personalizationNote ?? null,
      giftMessage: item.giftMessage ?? null,
      madeToOrderSnapshot: product.madeToOrder,
      productionLeadTimeDaysSnapshot: product.productionLeadTimeDays,
    });
    pricedLines.push({ unitPrice, quantity });
  }

  return { ok: true, lines, pricedLines };
}
