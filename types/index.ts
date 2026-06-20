/**
 * Shared application types — the documented shapes of JSON columns (CANON §3.5)
 * and the client-side cart model. Validated with Zod at the application boundary.
 */

export interface Dimensions {
  length?: number;
  width?: number;
  height?: number;
  diameter?: number;
  unit: "cm" | "in";
}

/** Indian shipping/billing address (CANON §3.5). */
export interface Address {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string; // one of INDIAN_STATES
  pincode: string; // 6-digit
  country: "IN";
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  pinterest?: string;
  youtube?: string;
  whatsapp?: string;
}

export interface ShippingDefaults {
  flatRatePaise: number;
  freeShippingThresholdPaise: number;
  codEnabled: boolean;
}

export interface DefaultSeo {
  titleTemplate: string;
  defaultDescription: string;
  ogImageId?: string;
  twitterHandle?: string;
}

export interface AnnouncementBar {
  enabled: boolean;
  text: string;
  href?: string;
}

/** A single line in the guest's client-side (localStorage) cart. */
export interface CartItem {
  productId: string;
  slug: string;
  title: string;
  sku: string;
  unitPrice: number; // paise (snapshot; re-validated at load & checkout)
  quantity: number;
  imageUrl?: string;
  personalizationNote?: string;
  giftMessage?: string;
  madeToOrder?: boolean;
  /** Max orderable quantity captured at add time (for client clamping). */
  maxQuantity?: number;
}
