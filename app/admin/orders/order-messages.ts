import { NotificationChannel, OrderStatus } from "@prisma/client";

import { buildWhatsAppLink } from "@/lib/whatsapp";

/**
 * Pure, shared order-management helpers (docs/12 §3.4, FR-6/FR-16/FR-18). No DB,
 * no `server-only` — imported by the `"use server"` actions (`actions.ts`) AND
 * the client status control (`order-status-control.tsx`), so the courier list,
 * notify defaults, status→message bodies, and the event-note composer have a
 * single source of truth and are unit-testable in isolation.
 *
 * `"use server"` modules may export only async actions, so these constants/pure
 * functions deliberately live here, not in `actions.ts`.
 */

/** Indian couriers offered on the ship transition (docs/12 FR-6, assumption). */
export const COURIERS = [
  "Delhivery",
  "Blue Dart",
  "DTDC",
  "India Post",
  "Shiprocket",
  "XpressBees",
  "Ekart",
  "Other",
] as const;

export type Courier = (typeof COURIERS)[number];

/** Per-transition default notification channels, pre-checked in the UI (FR-15). */
export const NOTIFY_DEFAULTS: Partial<
  Record<OrderStatus, { email: boolean; whatsapp: boolean }>
> = {
  confirmed: { email: true, whatsapp: true },
  in_production: { email: true, whatsapp: false },
  ready_to_ship: { email: false, whatsapp: false },
  shipped: { email: true, whatsapp: true },
  delivered: { email: true, whatsapp: false },
  cancelled: { email: true, whatsapp: true },
  on_hold: { email: false, whatsapp: true },
};

/** Primary "Advance" button label per target status (docs/12 FR-27). */
export const ADVANCE_LABEL: Partial<Record<OrderStatus, string>> = {
  confirmed: "Confirm order",
  in_production: "Start production",
  ready_to_ship: "Mark ready to ship",
  shipped: "Mark shipped",
  delivered: "Mark delivered",
};

/** The most-likely next step from a status — the primary button target (FR-27). */
export const PRIMARY_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending_confirmation: OrderStatus.confirmed,
  confirmed: OrderStatus.ready_to_ship,
  in_production: OrderStatus.ready_to_ship,
  ready_to_ship: OrderStatus.shipped,
  shipped: OrderStatus.delivered,
  on_hold: OrderStatus.confirmed,
};

/**
 * Compose the human-readable `OrderStatusEvent.note` from structured inputs
 * (docs/12 FR-6). Ship details render as a recognisable prefix; a cancel/hold
 * reason and free-text note are appended. Returns `null` when nothing to store.
 */
export function composeEventNote(args: {
  toStatus: OrderStatus;
  note?: string;
  reason?: string;
  shipping?: { courierName: string; trackingNumber: string };
}): string | null {
  const parts: string[] = [];
  if (args.shipping) {
    parts.push(
      `Shipped via ${args.shipping.courierName} · Tracking ${args.shipping.trackingNumber}`,
    );
  }
  const reason = args.reason?.trim();
  if (reason && (args.toStatus === "cancelled" || args.toStatus === "on_hold")) {
    parts.push(`Reason: ${reason}`);
  }
  const note = args.note?.trim();
  if (note) parts.push(note);
  return parts.length ? parts.join(" — ") : null;
}

/**
 * The single `NotificationChannel` recorded on an event (docs/12 FR-16): the
 * highest-fidelity confirmed channel `email > sms > whatsapp`. Email/SMS are
 * server-sent + confirmable; WhatsApp is best-effort. Null when none chosen.
 */
export function primaryChannel(notify: {
  email: boolean;
  whatsapp: boolean;
  sms: boolean;
}): NotificationChannel | null {
  if (notify.email) return NotificationChannel.email;
  if (notify.sms) return NotificationChannel.sms;
  if (notify.whatsapp) return NotificationChannel.whatsapp;
  return null;
}

/** Inputs for the founder→buyer status WhatsApp message (docs/12 FR-18). */
export interface StatusWhatsAppArgs {
  customerPhone: string;
  customerName: string;
  orderNumber: string;
  toStatus: OrderStatus;
  trackUrl: string;
  courierName?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  reason?: string | null;
  storeName: string;
}

/**
 * Build the status-specific founder→buyer WhatsApp prefilled message (FR-18).
 * `firstName` = first token of the customer name. PURE string composition.
 */
export function buildStatusWhatsAppMessage(args: StatusWhatsAppArgs): string {
  const firstName = args.customerName.trim().split(/\s+/)[0] || "there";
  switch (args.toStatus) {
    case "confirmed":
      return `Hi ${firstName}! 🎉 Your ${args.storeName} order ${args.orderNumber} is confirmed. To complete it, you can pay via UPI/bank — reply here and I'll share the details. Track anytime: ${args.trackUrl}`;
    case "shipped":
      return `Hi ${firstName}! 📦 Your order ${args.orderNumber} has shipped via ${args.courierName ?? "courier"} (Tracking: ${args.trackingNumber ?? "—"}). Follow it here: ${args.trackingUrl || args.trackUrl}. Thank you for supporting handmade! 💕`;
    case "on_hold":
      return `Hi ${firstName}, a quick update on your order ${args.orderNumber}${args.reason ? `: ${args.reason}` : "."}. I'll keep you posted — reply here with any questions. 🙏`;
    case "cancelled":
      return `Hi ${firstName}, your order ${args.orderNumber} has been cancelled${args.reason ? ` (${args.reason})` : ""}. Any payment made will be refunded. So sorry for the inconvenience — reach out anytime. 🙏`;
    case "delivered":
      return `Hi ${firstName}! ✅ Your order ${args.orderNumber} was delivered. We'd love to hear how it went — and a review would mean the world to a small handmade brand. 💕`;
    default:
      return `Hi ${firstName}! There's an update on your ${args.storeName} order ${args.orderNumber}. Track it here: ${args.trackUrl}`;
  }
}

/**
 * Convenience: full `wa.me` link for a status update to the buyer's number.
 * Returns "" when no usable number (the UI then hides the CTA — `14` FR-25).
 */
export function buildStatusWhatsAppLink(args: StatusWhatsAppArgs): string {
  return buildWhatsAppLink(args.customerPhone, buildStatusWhatsAppMessage(args));
}

/** Label for an advance/change action targeting `target` (FR-27). */
export function advanceLabel(target: OrderStatus, fallbackLabel: string): string {
  return ADVANCE_LABEL[target] ?? `Move to ${fallbackLabel}`;
}
