/**
 * Inventory-state derivation. `inventoryState` is NOT stored (CANON FR-12);
 * it is computed at read time from the product's stock fields.
 */

export type InventoryState =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "made_to_order";

export interface InventoryInput {
  madeToOrder: boolean;
  inventoryQuantity: number;
  lowStockThreshold: number;
}

/** Derive the display inventory state per the CANON §6 rule. */
export function deriveInventoryState(p: InventoryInput): InventoryState {
  if (p.madeToOrder) return "made_to_order";
  if (p.inventoryQuantity <= 0) return "out_of_stock";
  if (p.inventoryQuantity <= p.lowStockThreshold) return "low_stock";
  return "in_stock";
}

/** A product can be added to cart / ordered unless it is out of stock. */
export function isOrderable(state: InventoryState): boolean {
  return state !== "out_of_stock";
}

/** Max units a guest can put in the cart for this product right now. */
export function purchasableQuantity(p: InventoryInput, cap = 99): number {
  if (p.madeToOrder) return cap;
  return Math.max(0, Math.min(cap, p.inventoryQuantity));
}
