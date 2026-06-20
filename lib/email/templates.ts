/**
 * Transactional email templates (PURE — no DB, no `server-only`, no fetch).
 *
 * These builders turn a small, typed `OrderEmailData` snapshot into branded,
 * inline-CSS HTML in the GooglyWoogly pink theme. They are pure so they are
 * unit-testable and safe to import anywhere; the actual send + logging lives in
 * `lib/email/transport.ts`, and the data is assembled in `lib/email/index.ts`.
 *
 * Design constraints (docs/14 §4.0–§4.2):
 *  - Single-column, ~600px, mobile-first; all CSS is INLINE (email clients strip
 *    <style>/<link> and class-based rules), so we cannot use the app's Tailwind
 *    tokens — we hard-code the brand hexes that mirror them.
 *  - Money is rendered via `formatPaise` (paise → ₹ en-IN). Never format inline.
 *  - The placement emails carry the "no payment now — we'll confirm & take
 *    payment on WhatsApp" reassurance (CANON §1; docs/14 FR-9/§4.1).
 *  - Data-light & frozen: everything comes from `OrderItem`/`Order` snapshots so
 *    the email is accurate forever (docs/14 §4.0; `03` FR-11).
 */

import { formatPaise } from "@/lib/money";

// ───────────────────────────── brand palette (mirrors globals.css) ─────────────────────────────
// Inline-only hexes. These intentionally match the Tailwind v4 tokens so the
// email reads as the same brand, but they are literals because email HTML cannot
// reference CSS variables/utility classes reliably.
const BRAND = {
  primary: "#FF8FAB", // --primary warm pink
  primaryDark: "#E76B8A", // accessible text-on-light / hover
  ink: "#3F2A33", // deep plum-brown body text (AA on cream)
  muted: "#8A7480", // muted-foreground
  cream: "#FFF7F2", // page background (warm off-white)
  card: "#FFFFFF",
  border: "#F3D9E2", // soft pink border
  pastelPink: "#FFE3EC",
  pastelMint: "#D8F3E6",
  pastelYellow: "#FFF3C4",
  onPrimary: "#FFFFFF",
} as const;

const FONT_STACK =
  "'Quicksand', ui-rounded, 'Segoe UI', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";
const SERIF_STACK = "'Playfair Display', Georgia, 'Times New Roman', serif";

// ───────────────────────────── typed snapshot ─────────────────────────────

/** A single frozen order line for the email (from `OrderItem`). */
export interface OrderEmailItem {
  productTitle: string;
  quantity: number;
  unitPrice: number; // paise
  lineTotal: number; // paise
  personalizationNote?: string | null;
  giftMessage?: string | null;
  madeToOrder?: boolean | null;
  productionLeadTimeDays?: number | null;
}

/** Coarse, display-ready shipping address (already formatted upstream). */
export interface OrderEmailAddress {
  fullName: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  phone?: string | null;
}

/**
 * The complete, data-light payload both order emails render from. Assembled by
 * `lib/email/index.ts` from the `Order` + `OrderItem[]` + `SiteSetting`. Money is
 * paise; dates are pre-formatted IST strings (templates never touch timezones).
 */
export interface OrderEmailData {
  storeName: string;
  orderNumber: string;
  /** Pre-formatted IST placement time, e.g. "13 Jun 2026, 2:02 pm". */
  placedAtIST: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  items: OrderEmailItem[];
  subtotal: number; // paise
  shippingFee: number; // paise
  discountTotal: number; // paise
  taxTotal: number; // paise
  grandTotal: number; // paise
  shippingAddress: OrderEmailAddress | null;
  customerNote?: string | null;
  giftMessage?: string | null;
  /** Internal `/track/[token]` URL (absolute). */
  trackingUrl?: string | null;
  /** `wa.me` handoff link to the founder (absolute). Empty/omitted ⇒ hidden. */
  whatsappUrl?: string | null;
  /** `/admin/orders/[id]` deep link (absolute) — admin email only. */
  adminOrderUrl?: string | null;
  /** Founder → customer `wa.me` link (absolute) — admin email only. */
  whatsappCustomerUrl?: string | null;
}

/** What every template builder returns. */
export interface EmailContent {
  subject: string;
  html: string;
}

// ───────────────────────────── escaping ─────────────────────────────

/**
 * HTML-escape an untrusted/user-authored value (names, notes, personalization,
 * addresses). Every interpolation of dynamic text goes through this — never
 * inject raw strings into the HTML.
 */
function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ───────────────────────────── shared partials ─────────────────────────────

function styledButton(href: string, label: string, variant: "primary" | "outline" = "primary"): string {
  const bg = variant === "primary" ? BRAND.primary : BRAND.card;
  const color = variant === "primary" ? BRAND.onPrimary : BRAND.primaryDark;
  const border = variant === "primary" ? BRAND.primary : BRAND.border;
  return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${bg};color:${color};border:2px solid ${border};text-decoration:none;font-family:${FONT_STACK};font-weight:700;font-size:15px;line-height:1;padding:14px 28px;border-radius:9999px;mso-padding-alt:0;">${esc(label)}</a>`;
}

/** A line-item table row (frozen snapshot). */
function itemRow(item: OrderEmailItem): string {
  const notes: string[] = [];
  if (item.personalizationNote?.trim()) {
    notes.push(`✏️ ${esc(item.personalizationNote.trim())}`);
  }
  if (item.giftMessage?.trim()) {
    notes.push(`🎁 “${esc(item.giftMessage.trim())}”`);
  }
  if (item.madeToOrder) {
    const lead =
      item.productionLeadTimeDays && item.productionLeadTimeDays > 0
        ? ` · ships in ~${item.productionLeadTimeDays} days`
        : "";
    notes.push(`Made to order${lead}`);
  }
  const subLine = notes.length
    ? `<div style="margin-top:4px;font-size:12px;color:${BRAND.muted};font-family:${FONT_STACK};">${notes.join(
        " &nbsp;·&nbsp; ",
      )}</div>`
    : "";

  return `<tr>
  <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};vertical-align:top;font-family:${FONT_STACK};color:${BRAND.ink};font-size:14px;">
    <div style="font-weight:600;">${esc(item.productTitle)}</div>
    <div style="margin-top:2px;font-size:12px;color:${BRAND.muted};">Qty ${esc(
      item.quantity,
    )} × ${esc(formatPaise(item.unitPrice))}</div>
    ${subLine}
  </td>
  <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};vertical-align:top;text-align:right;white-space:nowrap;font-family:${FONT_STACK};color:${BRAND.ink};font-size:14px;font-weight:700;">${esc(
    formatPaise(item.lineTotal),
  )}</td>
</tr>`;
}

function totalsRow(label: string, value: string, emphasize = false): string {
  const weight = emphasize ? "800" : "500";
  const size = emphasize ? "16px" : "14px";
  const color = emphasize ? BRAND.ink : BRAND.muted;
  const borderTop = emphasize ? `border-top:2px solid ${BRAND.border};` : "";
  return `<tr>
  <td style="padding:6px 0;${borderTop}font-family:${FONT_STACK};color:${color};font-size:${size};font-weight:${weight};">${esc(
    label,
  )}</td>
  <td style="padding:6px 0;${borderTop}text-align:right;white-space:nowrap;font-family:${FONT_STACK};color:${color};font-size:${size};font-weight:${weight};">${esc(
    value,
  )}</td>
</tr>`;
}

function totalsBlock(data: OrderEmailData): string {
  const rows: string[] = [
    totalsRow("Subtotal", formatPaise(data.subtotal)),
    totalsRow(
      "Shipping",
      data.shippingFee > 0 ? formatPaise(data.shippingFee) : "FREE",
    ),
  ];
  if (data.discountTotal > 0) {
    rows.push(totalsRow("Discount", `− ${formatPaise(data.discountTotal)}`));
  }
  if (data.taxTotal > 0) {
    rows.push(totalsRow("GST", formatPaise(data.taxTotal)));
  }
  rows.push(totalsRow("Total", formatPaise(data.grandTotal), true));

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">${rows.join(
    "",
  )}</table>`;
}

function itemsTable(data: OrderEmailData): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
  ${data.items.map(itemRow).join("")}
</table>${totalsBlock(data)}`;
}

function addressBlock(addr: OrderEmailAddress | null, heading = "Shipping to"): string {
  if (!addr) return "";
  const parts = [
    addr.line1,
    addr.line2 || undefined,
    addr.landmark || undefined,
    `${addr.city}, ${addr.state} ${addr.pincode}`,
  ]
    .filter(Boolean)
    .map((p) => esc(p))
    .join("<br />");
  const phone = addr.phone?.trim()
    ? `<div style="margin-top:6px;color:${BRAND.muted};">📞 ${esc(addr.phone.trim())}</div>`
    : "";
  return `<div style="margin-top:20px;">
  <div style="font-family:${FONT_STACK};font-weight:700;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.muted};margin-bottom:6px;">${esc(
    heading,
  )}</div>
  <div style="font-family:${FONT_STACK};font-size:14px;color:${BRAND.ink};line-height:1.5;">
    <strong>${esc(addr.fullName)}</strong><br />${parts}
    ${phone}
  </div>
</div>`;
}

/** Pastel callout card (mint by default). Used for reassurance / notes. */
function callout(html: string, tone: "mint" | "pink" | "yellow" = "mint"): string {
  const bg =
    tone === "pink" ? BRAND.pastelPink : tone === "yellow" ? BRAND.pastelYellow : BRAND.pastelMint;
  return `<div style="background:${bg};border-radius:16px;padding:16px 18px;margin-top:20px;font-family:${FONT_STACK};font-size:14px;line-height:1.55;color:${BRAND.ink};">${html}</div>`;
}

/**
 * Full responsive email document. The header carries the store name in the serif
 * brand font on a pink band; the footer carries the handmade-in-Jaipur line.
 */
function shell(opts: {
  storeName: string;
  preheader: string;
  bodyHtml: string;
  footerExtra?: string;
}): string {
  const { storeName, preheader, bodyHtml, footerExtra = "" } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(storeName)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${esc(
    preheader,
  )}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};">
<tr>
<td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:24px;overflow:hidden;">
  <tr>
    <td align="center" style="background:${BRAND.primary};padding:28px 24px;">
      <div style="font-family:${SERIF_STACK};font-size:24px;font-weight:700;color:${BRAND.onPrimary};letter-spacing:0.01em;">${esc(
    storeName,
  )}</div>
      <div style="font-family:${FONT_STACK};font-size:12px;color:${BRAND.onPrimary};opacity:0.9;margin-top:4px;">Handmade in Jaipur, India 🇮🇳</div>
    </td>
  </tr>
  <tr>
    <td style="padding:28px 28px 8px;">
      ${bodyHtml}
    </td>
  </tr>
  <tr>
    <td style="padding:20px 28px 28px;">
      <hr style="border:none;border-top:1px solid ${BRAND.border};margin:0 0 16px;" />
      <div style="font-family:${FONT_STACK};font-size:12px;color:${BRAND.muted};line-height:1.6;">
        <strong style="color:${BRAND.ink};">${esc(storeName)}</strong> · Handmade in Jaipur 🇮🇳<br />
        ${footerExtra}
      </div>
    </td>
  </tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 12px;font-family:${SERIF_STACK};font-size:22px;line-height:1.25;font-weight:700;color:${BRAND.ink};">${esc(
    text,
  )}</h1>`;
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 14px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${BRAND.ink};">${html}</p>`;
}

function ctaRow(buttons: string[]): string {
  if (!buttons.length) return "";
  return `<div style="margin:22px 0 6px;">${buttons
    .map((b) => `<span style="display:inline-block;margin:0 8px 10px 0;">${b}</span>`)
    .join("")}</div>`;
}

/** Plaintext fallback URL printed under a CTA (survives plaintext-stripping). */
function plainUrl(label: string, url: string): string {
  return `<div style="margin:2px 0 10px;font-family:${FONT_STACK};font-size:12px;color:${BRAND.muted};word-break:break-all;">${esc(
    label,
  )} <a href="${esc(url)}" style="color:${BRAND.primaryDark};" target="_blank" rel="noopener noreferrer">${esc(
    url,
  )}</a></div>`;
}

// ───────────────────────────── customer: order received ─────────────────────────────

/**
 * `order_received_customer` — the instant, branded placement email
 * (docs/14 §4.1). Recipient: `Order.customerEmail`. Leads with the "no payment
 * was taken; we'll confirm & take payment on WhatsApp" reassurance.
 */
export function buildOrderReceivedCustomerEmail(data: OrderEmailData): EmailContent {
  const subject = `Order ${data.orderNumber} received ✨ — we’ll confirm on WhatsApp`;

  const ctas: string[] = [];
  const plainLinks: string[] = [];
  if (data.whatsappUrl) {
    ctas.push(styledButton(data.whatsappUrl, "💬 Continue on WhatsApp", "primary"));
  }
  if (data.trackingUrl) {
    ctas.push(styledButton(data.trackingUrl, "🔗 Track your order", "outline"));
    plainLinks.push(plainUrl("Track your order:", data.trackingUrl));
  }

  const giftBlock = data.giftMessage?.trim()
    ? callout(`<strong>Gift message:</strong> “${esc(data.giftMessage.trim())}”`, "pink")
    : "";

  const body = [
    h1(`Thank you, ${data.customerName}! Your order is in.`),
    paragraph(
      "We’ve received your order and saved it safely. <strong>Each piece is handmade</strong>, so the next step is a quick WhatsApp chat where we confirm availability (and any made-to-order lead times) and share <strong>secure payment details</strong>.",
    ),
    callout(
      "💛 <strong>No payment was taken on the site.</strong> We’ll confirm your order and take payment over WhatsApp — nothing was charged yet.",
      "mint",
    ),
    `<div style="margin-top:22px;font-family:${FONT_STACK};font-weight:700;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.muted};">Order ${esc(
      data.orderNumber,
    )} · ${esc(data.placedAtIST)}</div>`,
    itemsTable(data),
    addressBlock(data.shippingAddress),
    giftBlock,
    ctaRow(ctas),
    plainLinks.join(""),
    callout(
      "<strong>What happens next:</strong><br />1) We confirm on WhatsApp &nbsp;·&nbsp; 2) You pay securely via WhatsApp &nbsp;·&nbsp; 3) We craft &amp; ship pan-India.",
      "yellow",
    ),
  ].join("\n");

  const html = shell({
    storeName: data.storeName,
    preheader: `Order ${data.orderNumber} received — no payment taken yet; we’ll confirm on WhatsApp.`,
    bodyHtml: body,
    footerExtra: `Questions? Just reply to this email${
      data.whatsappUrl ? " or message us on WhatsApp" : ""
    } — we’re a small studio and we read every note. 💕`,
  });

  return { subject, html };
}

// ───────────────────────────── admin: order received ─────────────────────────────

/**
 * `order_received_admin` — the founder's instant "act now" alert
 * (docs/14 §4.2). Recipient: `SiteSetting.contactEmail`. Scannable + ops-first:
 * customer contact, items, total, address, notes, and a deep link into admin.
 */
export function buildOrderReceivedAdminEmail(data: OrderEmailData): EmailContent {
  const subject = `🛎️ New order ${data.orderNumber} — ${formatPaise(
    data.grandTotal,
  )} — ${data.customerName}`;

  const contactRows: string[] = [
    `<div><strong>${esc(data.customerName)}</strong></div>`,
  ];
  if (data.customerPhone?.trim()) {
    contactRows.push(`<div style="margin-top:2px;">📞 ${esc(data.customerPhone.trim())}</div>`);
  }
  if (data.customerEmail?.trim()) {
    contactRows.push(
      `<div style="margin-top:2px;">✉️ <a href="mailto:${esc(
        data.customerEmail.trim(),
      )}" style="color:${BRAND.primaryDark};">${esc(data.customerEmail.trim())}</a></div>`,
    );
  }

  const ctas: string[] = [];
  if (data.adminOrderUrl) {
    ctas.push(styledButton(data.adminOrderUrl, "Open in admin", "primary"));
  }
  if (data.whatsappCustomerUrl) {
    ctas.push(
      styledButton(data.whatsappCustomerUrl, `💬 Message ${data.customerName.split(" ")[0]}`, "outline"),
    );
  }

  const notes: string[] = [];
  if (data.customerNote?.trim()) {
    notes.push(`<strong>Customer note:</strong> ${esc(data.customerNote.trim())}`);
  }
  if (data.giftMessage?.trim()) {
    notes.push(`<strong>Gift message:</strong> “${esc(data.giftMessage.trim())}”`);
  }
  const hasMadeToOrder = data.items.some((i) => i.madeToOrder);
  if (hasMadeToOrder) {
    notes.push("⏳ <strong>Contains made-to-order items</strong> — check lead times before confirming.");
  }
  const notesBlock = notes.length ? callout(notes.join("<br /><br />"), "yellow") : "";

  const body = [
    h1(`New order — ${data.orderNumber}`),
    paragraph(`Placed ${esc(data.placedAtIST)} (IST). Act on WhatsApp to confirm &amp; collect payment.`),
    `<div style="font-family:${FONT_STACK};font-size:14px;color:${BRAND.ink};line-height:1.5;background:${BRAND.pastelPink};border-radius:16px;padding:14px 18px;">${contactRows.join(
      "",
    )}</div>`,
    `<div style="margin-top:20px;font-family:${FONT_STACK};font-weight:700;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.muted};">Items</div>`,
    itemsTable(data),
    addressBlock(data.shippingAddress),
    notesBlock,
    ctaRow(ctas),
    data.adminOrderUrl ? plainUrl("Open order:", data.adminOrderUrl) : "",
  ].join("\n");

  const html = shell({
    storeName: data.storeName,
    preheader: `New order ${data.orderNumber} — ${formatPaise(data.grandTotal)} from ${data.customerName}.`,
    bodyHtml: body,
    footerExtra: "Internal order alert — this email is for the studio team only.",
  });

  return { subject, html };
}

// ───────────────────────────── customer: status update (Phase 4 stub) ─────────────────────────────

/** Minimal payload for the generic status-update email (Phase 4 — docs/14 §4.3–§4.7). */
export interface OrderStatusEmailData {
  storeName: string;
  orderNumber: string;
  customerName: string;
  /** Buyer-facing stage label, e.g. "Confirmed", "Shipped". */
  statusLabel: string;
  /** One-line buyer-facing helper copy for this status. */
  statusMessage: string;
  trackingUrl?: string | null;
  whatsappUrl?: string | null;
}

/**
 * Generic per-status customer email (used by `notifyOrderStatusChange`, Phase 4).
 * A thin, on-brand status note + track/WhatsApp CTAs. The richer per-status
 * bodies (courier/tracking, payment instructions) land with the `12` status
 * actions in Phase 4; this is the shared skeleton.
 */
export function buildOrderStatusUpdateEmail(data: OrderStatusEmailData): EmailContent {
  const subject = `Update on your order ${data.orderNumber} — ${data.statusLabel}`;

  const ctas: string[] = [];
  const plainLinks: string[] = [];
  if (data.trackingUrl) {
    ctas.push(styledButton(data.trackingUrl, "🔗 Track your order", "primary"));
    plainLinks.push(plainUrl("Track your order:", data.trackingUrl));
  }
  if (data.whatsappUrl) {
    ctas.push(styledButton(data.whatsappUrl, "💬 Chat on WhatsApp", "outline"));
  }

  const body = [
    h1(`Hi ${data.customerName} — ${data.statusLabel}`),
    paragraph(esc(data.statusMessage)),
    `<div style="margin-top:8px;font-family:${FONT_STACK};font-weight:700;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.muted};">Order ${esc(
      data.orderNumber,
    )}</div>`,
    ctaRow(ctas),
    plainLinks.join(""),
  ].join("\n");

  const html = shell({
    storeName: data.storeName,
    preheader: `Your order ${data.orderNumber} is now ${data.statusLabel}.`,
    bodyHtml: body,
    footerExtra: "Reply any time — we’re here to help. 💕",
  });

  return { subject, html };
}
