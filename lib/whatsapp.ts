/**
 * WhatsApp click-to-chat deep-link builder (CANON §4: `wa.me` + prefilled text;
 * doc 14 §3.6 / §4.10; doc 08 §4.5). PURE — no DB, no `server-only`: these
 * builders are usable from both RSC (to render a CTA href) and client islands
 * (to rebuild the link on the fly). The analytics `whatsapp_click` event fires on
 * the client tap, never inside the builder.
 *
 * MVP WhatsApp is deep links only — no WhatsApp Business API (that is V2).
 */

import { formatPaise } from "./money";
import { publicEnv } from "./env";

/**
 * Build a `wa.me` deep link.
 *
 * - `number` is reduced to digits only (a `+` / spaces / dashes are stripped) so
 *   an E.164 input like `+91 63678 51899` becomes `916367851899`.
 * - `?text=` is appended (URL-encoded) only when a non-empty message is given;
 *   it is omitted entirely otherwise.
 *
 * Returns `""` when no usable digits remain so callers can hide a broken CTA
 * (doc 14 FR-25: hide WhatsApp CTAs when no number is configured).
 */
export function buildWhatsAppLink(number: string, message?: string): string {
  const digits = (number ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const base = `https://wa.me/${digits}`;
  const text = message?.trim();
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

// ───────────────────────────── message bodies ─────────────────────────────

/** Minimal product shape needed to build an enquiry message (typed-light). */
export interface WhatsAppProductInput {
  title: string;
  slug: string;
}

/** Minimal order line shape for the placement handoff (OrderItem snapshot). */
export interface WhatsAppOrderItemInput {
  productTitle: string;
  quantity: number;
  lineTotal: number; // paise
  personalizationNote?: string | null;
  madeToOrderSnapshot?: boolean | null;
}

/** Minimal order shape for the placement handoff (typed-light). */
export interface WhatsAppOrderInput {
  orderNumber: string;
  customerName: string;
  grandTotal: number; // paise
  items: WhatsAppOrderItemInput[];
}

/**
 * Buyer → founder enquiry from a PDP ("Ask on WhatsApp"). Pre-fills the product
 * title, its canonical URL, and a short question stub (doc 14 §4.10a).
 *
 * `siteUrl` defaults to the public site URL so the link is absolute in emails
 * and shareable; pass an override for previews/tests.
 */
export function buildProductEnquiryMessage(
  p: WhatsAppProductInput,
  siteUrl: string = publicEnv.siteUrl,
): string {
  const url = `${siteUrl.replace(/\/$/, "")}/products/${p.slug}`;
  return [
    `Hi GooglyWoogly Art! 👋 I'm interested in "${p.title}".`,
    url,
    "Could you tell me more about availability & customization?",
  ].join("\n");
}

/**
 * Buyer → founder handoff after placing an order (confirmation page + order
 * email). Pre-fills order number, line items (title × qty — lineTotal, with the
 * personalization note or "made to order" in parens), the grand total, and the
 * customer name. Mirrors doc 08 §4.5 / doc 14 §4.10b exactly.
 *
 * The full address/email are intentionally omitted — the order already has them.
 */
export function buildOrderPlacedMessage(order: WhatsAppOrderInput): string {
  const lines = order.items.map((it) => {
    const note = it.personalizationNote?.trim()
      ? `  (${it.personalizationNote.trim()})`
      : it.madeToOrderSnapshot
        ? "  (made to order)"
        : "";
    return `• ${it.productTitle} × ${it.quantity} — ${formatPaise(it.lineTotal)}${note}`;
  });

  return [
    "Hi GooglyWoogly Art! 👋 I just placed an order.",
    "",
    `Order: ${order.orderNumber}`,
    "Items:",
    ...lines,
    `Total: ${formatPaise(order.grandTotal)}`,
    "",
    `Name: ${order.customerName}`,
    "Please confirm availability & share payment details. Thank you!",
  ].join("\n");
}

/**
 * Convenience: full `wa.me` link for a PDP enquiry to the store's number.
 */
export function buildProductEnquiryLink(
  number: string,
  p: WhatsAppProductInput,
  siteUrl?: string,
): string {
  return buildWhatsAppLink(number, buildProductEnquiryMessage(p, siteUrl));
}

/**
 * Convenience: full `wa.me` link for the order-placed handoff to the store's
 * number.
 */
export function buildOrderPlacedLink(
  number: string,
  order: WhatsAppOrderInput,
): string {
  return buildWhatsAppLink(number, buildOrderPlacedMessage(order));
}
