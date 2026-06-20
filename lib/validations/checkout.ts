/**
 * Checkout / order-placement input validation (CANON `08` §6.4).
 *
 * PURE: no DB, no `server-only` — these schemas are shared by the checkout form
 * (react-hook-form + zodResolver) and re-validated by the `placeOrder` server
 * action. Reuses the shared primitives in `lib/validations/common` so phone /
 * pincode / state / address rules are defined exactly once.
 *
 * Money is **not** trusted from the client at placement — the cart's
 * `unitPrice` is advisory (`08` FR-4/FR-29); `placeOrder` re-reads the
 * authoritative price server-side. We still validate its shape here.
 *
 * Character limits (`08` FR-8):
 *   personalizationNote ≤ 100 · per-item giftMessage ≤ 250 ·
 *   order-level giftMessage ≤ 300 · customerNote ≤ 500
 * Caps (`08` §6.4): qty 1–99 per line · ≤ 30 distinct lines.
 */
import { z } from "zod";
import {
  emailSchema,
  phoneSchema,
  addressSchema,
} from "@/lib/validations/common";

/** Char limits, exported so the cart store can truncate-guard with the same numbers. */
export const CHECKOUT_LIMITS = {
  personalizationNote: 100,
  itemGiftMessage: 250,
  orderGiftMessage: 300,
  customerNote: 500,
  maxQuantityPerLine: 99,
  maxLineItems: 30,
} as const;

/**
 * A single cart line as submitted to the server. `unitPrice` (paise snapshot)
 * is optional and advisory — the server recomputes the real price; we keep it
 * so the placement diff can show "price changed".
 */
export const cartItemSchema = z.object({
  productId: z.string().min(1, "Missing product."),
  quantity: z
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(CHECKOUT_LIMITS.maxQuantityPerLine, "Quantity is too large."),
  unitPrice: z.number().int().min(0).optional(),
  personalizationNote: z
    .string()
    .trim()
    .max(CHECKOUT_LIMITS.personalizationNote)
    .optional(),
  giftMessage: z
    .string()
    .trim()
    .max(CHECKOUT_LIMITS.itemGiftMessage)
    .optional(),
});

/** Buyer contact block (CANON `08` FR-17): all three required. */
export const checkoutContactSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, "Please enter your name.")
    .max(80, "Name is too long."),
  customerPhone: phoneSchema,
  customerEmail: emailSchema,
});

/** Full `placeOrder` input (CANON `08` §6.3/§6.4). */
export const checkoutSchema = z.object({
  contact: checkoutContactSchema,
  shippingAddress: addressSchema,
  items: z
    .array(cartItemSchema)
    .min(1, "Your cart is empty.")
    .max(CHECKOUT_LIMITS.maxLineItems, "Too many items in your cart."),
  customerNote: z
    .string()
    .trim()
    .max(CHECKOUT_LIMITS.customerNote)
    .optional(),
  giftMessage: z
    .string()
    .trim()
    .max(CHECKOUT_LIMITS.orderGiftMessage)
    .optional(),
  /** Idempotency guard for double-submit (`08` FR-38). Optional at the schema
   *  level so a form can omit it; the action supplies one when absent. */
  clientRequestId: z.string().uuid("Invalid request id.").optional(),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;
export type CheckoutContactInput = z.infer<typeof checkoutContactSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
