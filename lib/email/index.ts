import "server-only";

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { Address } from "@/types";
import { publicEnv } from "@/lib/env";
import { formatDateTimeIST } from "@/lib/format";
import { buildWhatsAppLink, buildOrderPlacedMessage } from "@/lib/whatsapp";
import { sendEmail } from "./transport";
import {
  buildOrderReceivedCustomerEmail,
  buildOrderReceivedAdminEmail,
  buildOrderStatusUpdateEmail,
  type OrderEmailData,
  type OrderEmailItem,
  type OrderEmailAddress,
} from "./templates";

/**
 * Transactional notification orchestration (docs/14 §6.2).
 *
 * CONTRACT: the rest of the system imports `notifyOrderPlaced` from
 * "@/lib/email". It is fire-and-forget **after** the placement commit
 * (`08` FR-37) — it reads the order, builds both placement emails, sends the
 * customer + admin alerts (each logged via the transport's `NotificationLog`
 * write), and **never throws**: any error is caught and logged so a notification
 * failure can never roll back or block the order.
 *
 * `notifyOrderStatusChange` is the Phase-4 thin stub that emails the customer a
 * simple status-update note when a `12` transition opts to notify.
 */

// ───────────────────────────── data assembly ─────────────────────────────

/** Columns needed to render the placement emails (frozen snapshots). */
const orderEmailSelect = {
  id: true,
  orderNumber: true,
  trackingToken: true,
  status: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  shippingAddress: true,
  subtotal: true,
  shippingFee: true,
  discountTotal: true,
  taxTotal: true,
  grandTotal: true,
  customerNote: true,
  giftMessage: true,
  createdAt: true,
  items: {
    select: {
      productTitle: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      personalizationNote: true,
      giftMessage: true,
      madeToOrderSnapshot: true,
      productionLeadTimeDaysSnapshot: true,
    },
    orderBy: { lineTotal: "desc" },
  },
} satisfies Prisma.OrderSelect;

type OrderEmailRow = Prisma.OrderGetPayload<{ select: typeof orderEmailSelect }>;

/** Narrow the JSONB shipping address to the display shape — never throws. */
function toEmailAddress(value: Prisma.JsonValue | null): OrderEmailAddress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const addr = value as Partial<Address>;
  if (
    typeof addr.fullName !== "string" ||
    typeof addr.line1 !== "string" ||
    typeof addr.city !== "string" ||
    typeof addr.state !== "string" ||
    typeof addr.pincode !== "string"
  ) {
    return null;
  }
  return {
    fullName: addr.fullName,
    line1: addr.line1,
    line2: addr.line2 ?? null,
    landmark: addr.landmark ?? null,
    city: addr.city,
    state: addr.state,
    pincode: addr.pincode,
    phone: typeof addr.phone === "string" ? addr.phone : null,
  };
}

function toEmailItems(rows: OrderEmailRow["items"]): OrderEmailItem[] {
  return rows.map((it) => ({
    productTitle: it.productTitle,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    lineTotal: it.lineTotal,
    personalizationNote: it.personalizationNote,
    giftMessage: it.giftMessage,
    madeToOrder: it.madeToOrderSnapshot,
    productionLeadTimeDays: it.productionLeadTimeDaysSnapshot,
  }));
}

/** Absolute URL on the public site (no double slash). */
function absolute(path: string): string {
  return `${publicEnv.siteUrl.replace(/\/$/, "")}${path}`;
}

// ───────────────────────────── notifyOrderPlaced ─────────────────────────────

/**
 * Send the placement emails for a freshly placed order (docs/14 §4.1/§4.2):
 *  - `order_received_customer` → `order.customerEmail`
 *  - `order_received_admin`    → `SiteSetting.contactEmail`
 *
 * Reads the order + items + settings, builds the shared `OrderEmailData`, and
 * sends both (each logged). Never throws.
 */
export async function notifyOrderPlaced(orderId: string): Promise<void> {
  try {
    if (!orderId) return;

    const [order, settings] = await Promise.all([
      prisma.order.findUnique({ where: { id: orderId }, select: orderEmailSelect }),
      prisma.siteSetting.findUnique({
        where: { id: "singleton" },
        select: { storeName: true, contactEmail: true, whatsappNumber: true },
      }),
    ]);

    if (!order) {
      console.error(`[email] notifyOrderPlaced: order ${orderId} not found`);
      return;
    }

    const storeName = settings?.storeName ?? "GooglyWoogly Art";
    const whatsappNumber = settings?.whatsappNumber ?? "";
    const contactEmail = settings?.contactEmail ?? "";

    const items = toEmailItems(order.items);
    const shippingAddress = toEmailAddress(order.shippingAddress);

    // Buyer → founder handoff link (omitted when no WhatsApp number — FR-25).
    const whatsappUrl = whatsappNumber
      ? buildWhatsAppLink(
          whatsappNumber,
          buildOrderPlacedMessage({
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            grandTotal: order.grandTotal,
            items: order.items.map((it) => ({
              productTitle: it.productTitle,
              quantity: it.quantity,
              lineTotal: it.lineTotal,
              personalizationNote: it.personalizationNote,
              madeToOrderSnapshot: it.madeToOrderSnapshot,
            })),
          }),
        )
      : "";

    // Founder → customer link (admin email CTA) — to the buyer's own number.
    const whatsappCustomerUrl = order.customerPhone
      ? buildWhatsAppLink(
          order.customerPhone,
          `Hi ${order.customerName.split(" ")[0]}! 👋 This is ${storeName} about your order ${order.orderNumber}. We’re confirming availability and will share secure payment details here shortly. 🙏`,
        )
      : "";

    const data: OrderEmailData = {
      storeName,
      orderNumber: order.orderNumber,
      placedAtIST: formatDateTimeIST(order.createdAt),
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      items,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      discountTotal: order.discountTotal,
      taxTotal: order.taxTotal,
      grandTotal: order.grandTotal,
      shippingAddress,
      customerNote: order.customerNote,
      giftMessage: order.giftMessage,
      trackingUrl: absolute(`/track/${order.trackingToken}`),
      whatsappUrl,
      adminOrderUrl: absolute(`/admin/orders/${order.id}`),
      whatsappCustomerUrl,
    };

    // ── Customer placement email ──
    if (order.customerEmail?.trim()) {
      const customerEmail = buildOrderReceivedCustomerEmail(data);
      await sendEmail({
        to: order.customerEmail,
        subject: customerEmail.subject,
        html: customerEmail.html,
        replyTo: contactEmail || undefined,
        template: "order_received_customer",
        orderId: order.id,
      });
    } else {
      console.warn(`[email] order ${order.orderNumber} has no customer email; skipping buyer email`);
    }

    // ── Admin alert email ──
    if (contactEmail.trim()) {
      const adminEmail = buildOrderReceivedAdminEmail(data);
      await sendEmail({
        to: contactEmail,
        subject: adminEmail.subject,
        html: adminEmail.html,
        replyTo: order.customerEmail || undefined,
        template: "order_received_admin",
        orderId: order.id,
      });
    } else {
      console.warn(`[email] no SiteSetting.contactEmail configured; skipping admin alert`);
    }
  } catch (err) {
    // Fire-and-forget contract: swallow + log, never throw to the caller.
    console.error(
      `[email] notifyOrderPlaced failed for order ${orderId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ───────────────────────────── notifyOrderStatusChange (Phase 4 stub) ─────────────────────────────

/** Buyer-facing status copy for the simple update email (docs/14 §4.3–§4.7). */
const STATUS_COPY: Record<string, { label: string; message: string }> = {
  confirmed: {
    label: "Confirmed",
    message:
      "Great news — your order is confirmed! We’ll share secure payment details on WhatsApp if we haven’t already.",
  },
  in_production: {
    label: "Being handcrafted",
    message: "Your pieces are now being handcrafted in our Jaipur studio. ✨",
  },
  ready_to_ship: {
    label: "Packed & ready",
    message: "Your order is packed and ready to dispatch.",
  },
  shipped: {
    label: "Shipped",
    message: "Your order is on its way! 📦 Track it any time using the link below.",
  },
  delivered: {
    label: "Delivered",
    message: "Delivered! We hope you love it. 💝 Reply on WhatsApp if anything isn’t perfect.",
  },
  cancelled: {
    label: "Cancelled",
    message:
      "Your order has been cancelled. Any payment made will be refunded — we’ll sort it out on WhatsApp.",
  },
  on_hold: {
    label: "On hold",
    message: "We’ve paused your order for a moment — we’ll update you shortly on WhatsApp.",
  },
};

/**
 * Phase-4 stub: send a simple status-update email to the customer when a `12`
 * transition opts to notify. Reads the order + settings, picks the per-status
 * copy, and sends one logged email. Never throws.
 *
 * The richer per-status bodies (courier/tracking, payment instructions) are
 * wired alongside the `12` status actions in Phase 4; this gives a working,
 * on-brand baseline now.
 */
export async function notifyOrderStatusChange(orderId: string): Promise<void> {
  try {
    if (!orderId) return;

    const [order, settings] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        select: {
          orderNumber: true,
          status: true,
          customerName: true,
          customerEmail: true,
          trackingToken: true,
        },
      }),
      prisma.siteSetting.findUnique({
        where: { id: "singleton" },
        select: { storeName: true, contactEmail: true, whatsappNumber: true },
      }),
    ]);

    if (!order) {
      console.error(`[email] notifyOrderStatusChange: order ${orderId} not found`);
      return;
    }
    if (!order.customerEmail?.trim()) {
      console.warn(`[email] order ${order.orderNumber} has no customer email; skipping status email`);
      return;
    }

    const copy = STATUS_COPY[order.status] ?? {
      label: "Updated",
      message: "There’s an update on your order.",
    };
    const storeName = settings?.storeName ?? "GooglyWoogly Art";
    const whatsappNumber = settings?.whatsappNumber ?? "";

    const email = buildOrderStatusUpdateEmail({
      storeName,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      statusLabel: copy.label,
      statusMessage: copy.message,
      trackingUrl: absolute(`/track/${order.trackingToken}`),
      whatsappUrl: whatsappNumber ? buildWhatsAppLink(whatsappNumber) : "",
    });

    await sendEmail({
      to: order.customerEmail,
      subject: email.subject,
      html: email.html,
      replyTo: settings?.contactEmail || undefined,
      template: `order_${order.status}_customer`,
      orderId,
    });
  } catch (err) {
    console.error(
      `[email] notifyOrderStatusChange failed for order ${orderId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}
