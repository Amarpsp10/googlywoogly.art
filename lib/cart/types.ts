import type { CartItem } from "@/types";

export type { CartItem } from "@/types";

/**
 * Minimal product shape needed to add something to the cart. Storefront
 * components map their richer product type down to this.
 */
export interface AddToCartProduct {
  id: string;
  slug: string;
  title: string;
  sku: string;
  price: number; // paise
  imageUrl?: string;
  madeToOrder: boolean;
  inventoryQuantity: number;
  lowStockThreshold: number;
  allowsPersonalization: boolean;
}

/**
 * A cart line. `lineId` distinguishes otherwise-identical products that carry
 * different personalization (e.g. two engraved keychains with different names).
 */
export interface CartLine extends CartItem {
  lineId: string;
}

/** Stable identity for a line: product + its personalization text. */
export function lineIdFor(productId: string, personalizationNote?: string): string {
  return `${productId}::${(personalizationNote ?? "").trim()}`;
}
