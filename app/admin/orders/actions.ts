"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma, OrderStatus, PaymentStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/admin/audit";
import {
  ok,
  fail,
  failValidation,
  type ActionResult,
} from "@/lib/result";
import { canTransitionOrder } from "@/lib/constants";
import { publicEnv } from "@/lib/env";
import { notifyOrderStatusChange } from "@/lib/email";
import {
  composeEventNote,
  primaryChannel,
  buildStatusWhatsAppLink,
} from "./order-messages";

/**
 * Order management Server Actions (docs/12 §6). Every action:
 *  1. `requireAdmin()` — server-side authz gate (docs/12 FR-41: all roles may
 *     transition orders / set payment / add notes; export + GST invoice — out of
 *     scope here — are the only owner/admin-gated surfaces).
 *  2. Validates input with a Zod schema (parse → `failValidation` on error).
 *  3. Writes via Prisma inside one atomic `$transaction` (status change + the
 *     append-only `OrderStatusEvent` + `confirmedAt` side-effect all commit
 *     together — docs/12 FR-4/FR-5).
 *  4. `writeAudit(...)` — the `order.*` audit row (docs/12 FR-40).
 *  5. Revalidates the admin detail/list paths so the RSC re-reads fresh data.
 *  6. Returns an `ActionResult` (never throws across the boundary).
 *
 * Post-commit side-effects (customer email) are **best-effort** and run AFTER
 * the transaction commits: a notification failure can never roll back the status
 * change (docs/12 FR-42, the `08` FR-37 pattern). `notifyOrderStatusChange`
 * already swallows + logs its own errors.
 *
 * IMPORTANT — inventory: CANON R-9 is authoritative — `placeOrder` **validates**
 * stock but never decrements it (stock is admin-managed). docs/12 FR-7 describes
 * a cancel-restock, but that step assumes placement decremented stock; since this
 * codebase never does, restocking on cancel would *inflate* inventory. We
 * therefore do NOT restock on cancel, and order mutations revalidate **no**
 * storefront catalog tags (docs/12 FR-43) — only the admin paths.
 *
 * Money is integer paise throughout (CANON §10).
 */

// ───────────────────────────── shared validation ─────────────────────────────

/** A CUID order id — the internal key for every order mutation. */
const orderIdSchema = z.string().cuid("Invalid order id.");

/**
 * Per-transition notification channel choices (docs/12 FR-13). The founder ticks
 * which channels to notify the customer on. SMS is V1 (hidden until DLT), so it
 * is accepted but ignored here. WhatsApp is a manual deep-link the founder taps
 * (built + returned for the UI), so it is not an automated "send" — only `email`
 * drives the automated `customerNotified` flag below.
 */
const notifySchema = z
  .object({
    email: z.boolean().default(false),
    whatsapp: z.boolean().default(false),
    sms: z.boolean().default(false),
  })
  .default({});

/** Ship details required on the `→ shipped` transition (docs/12 FR-6). */
const shippingSchema = z.object({
  courierName: z.string().trim().min(1, "Courier is required.").max(60),
  trackingNumber: z.string().trim().min(1, "Tracking number is required.").max(60),
  trackingUrl: z
    .string()
    .trim()
    .url("Enter a valid URL.")
    .max(300)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/** `transitionOrderStatus` input (docs/12 §6.1). */
const transitionOrderStatusSchema = z.object({
  orderId: orderIdSchema,
  toStatus: z.nativeEnum(OrderStatus),
  note: z.string().trim().max(1000).optional(),
  notify: notifySchema,
  /** Required (and only valid) when `toStatus === "shipped"`. */
  shipping: shippingSchema.optional(),
  /** Surfaced to the buyer for cancelled / on_hold. */
  reason: z.string().trim().max(500).optional(),
  /** Optimistic-concurrency guard against two-device races (docs/12 §6.1). */
  expectedCurrentStatus: z.nativeEnum(OrderStatus).optional(),
});

/** `setPaymentStatus` input (docs/12 §6.2 `markPayment`). */
const setPaymentStatusSchema = z.object({
  orderId: orderIdSchema,
  paymentStatus: z.nativeEnum(PaymentStatus),
  /** Optional paise amount recorded on `Order.amountPaid` (docs/12 FR-11). */
  amountPaid: z.number().int().nonnegative().max(100_000_000_00).optional(),
  addTimelineNote: z.boolean().default(false),
  note: z.string().trim().max(500).optional(),
});

/** `markShipped` input — a focused `→ shipped` transition (docs/12 FR-6). */
const markShippedSchema = z.object({
  orderId: orderIdSchema,
  courierName: z.string().trim().min(1, "Courier is required.").max(60),
  trackingNumber: z.string().trim().min(1, "Tracking number is required.").max(60),
  trackingUrl: z
    .string()
    .trim()
    .url("Enter a valid URL.")
    .max(300)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  note: z.string().trim().max(1000).optional(),
  notify: notifySchema,
  expectedCurrentStatus: z.nativeEnum(OrderStatus).optional(),
});

/** `addInternalNote` input (docs/12 §6.4 `updateOrderNotes`). */
const addInternalNoteSchema = z.object({
  orderId: orderIdSchema,
  /** The full replacement value for `Order.internalNotes` (autosave on blur). */
  internalNotes: z.string().max(5000),
});

// ───────────────────────────── result payloads ─────────────────────────────

/** Returned by the transition/ship actions so the UI can reflect the new state. */
export interface TransitionResult {
  status: OrderStatus;
  /** Set when the founder chose the WhatsApp channel — the UI opens this link. */
  whatsappUrl?: string;
}

export interface PaymentResult {
  paymentStatus: PaymentStatus;
}

// ───────────────────────────── helpers ─────────────────────────────

/** Absolute public-site URL for a tracking token (no double slash). */
function absoluteTrackUrl(token: string): string {
  return `${publicEnv.siteUrl.replace(/\/$/, "")}/track/${token}`;
}

// ───────────────────────────── transitionOrderStatus ─────────────────────────────

/**
 * Advance an order's **fulfillment** `status` along a legal transition
 * (docs/12 §6.1). Enforces `canTransitionOrder` (CANON §7), appends an
 * `OrderStatusEvent`, sets `confirmedAt` once on `→ confirmed`, persists
 * courier/tracking on `→ shipped`, audits, then (post-commit, best-effort) emails
 * the customer when chosen and returns the prefilled WhatsApp link when chosen.
 *
 * Payment is a **separate** axis — never touched here (docs/12 FR-1); use
 * `setPaymentStatus`.
 */
export async function transitionOrderStatus(
  input: z.infer<typeof transitionOrderStatusSchema>,
): Promise<ActionResult<TransitionResult>> {
  const admin = await requireAdmin();

  const parsed = transitionOrderStatusSchema.safeParse(input);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  // The `shipped` transition requires courier + tracking (docs/12 FR-6).
  if (data.toStatus === "shipped" && !data.shipping) {
    return fail("Courier and tracking number are required to mark this order shipped.", {
      shipping: ["Courier and tracking number are required."],
    });
  }

  return applyTransition({
    admin,
    orderId: data.orderId,
    toStatus: data.toStatus,
    note: data.note,
    reason: data.reason,
    shipping: data.shipping,
    notify: data.notify,
    expectedCurrentStatus: data.expectedCurrentStatus,
  });
}

// ───────────────────────────── markShipped ─────────────────────────────

/**
 * Convenience wrapper for the high-frequency `→ shipped` dispatch (docs/12 FR-6):
 * captures courier + tracking (+ optional URL) and moves the order to `shipped`,
 * sharing the exact same transition engine + guards as `transitionOrderStatus`.
 */
export async function markShipped(
  input: z.infer<typeof markShippedSchema>,
): Promise<ActionResult<TransitionResult>> {
  const admin = await requireAdmin();

  const parsed = markShippedSchema.safeParse(input);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  return applyTransition({
    admin,
    orderId: data.orderId,
    toStatus: OrderStatus.shipped,
    note: data.note,
    shipping: {
      courierName: data.courierName,
      trackingNumber: data.trackingNumber,
      trackingUrl: data.trackingUrl,
    },
    notify: data.notify,
    expectedCurrentStatus: data.expectedCurrentStatus,
  });
}

/**
 * Shared transition engine for `transitionOrderStatus` + `markShipped`. Loads the
 * order, enforces optimistic concurrency + the legal-transition guard, applies
 * the status change + `OrderStatusEvent` + `confirmedAt`/courier side-effects +
 * audit in one transaction, then runs post-commit notifications.
 */
async function applyTransition(args: {
  admin: { id: string };
  orderId: string;
  toStatus: OrderStatus;
  note?: string;
  reason?: string;
  shipping?: { courierName: string; trackingNumber: string; trackingUrl?: string };
  notify: { email: boolean; whatsapp: boolean; sms: boolean };
  expectedCurrentStatus?: OrderStatus;
}): Promise<ActionResult<TransitionResult>> {
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      confirmedAt: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      trackingToken: true,
    },
  });
  if (!order) return fail("Order not found.");

  // Optimistic concurrency — another device may have advanced it (docs/12 §6.1).
  if (
    args.expectedCurrentStatus &&
    args.expectedCurrentStatus !== order.status
  ) {
    return fail("This order changed elsewhere. Refresh and try again.");
  }

  // No-op guard: re-submitting the current status is not a legal transition.
  if (order.status === args.toStatus) {
    return fail(`Order is already ${args.toStatus.replace(/_/g, " ")}.`);
  }

  // CANON §7 state machine (docs/12 FR-3).
  if (!canTransitionOrder(order.status, args.toStatus)) {
    return fail(
      `Cannot move an order from ${order.status.replace(/_/g, " ")} to ${args.toStatus.replace(/_/g, " ")}.`,
    );
  }

  const eventNote = composeEventNote({
    toStatus: args.toStatus,
    note: args.note,
    reason: args.reason,
    shipping: args.shipping,
  });
  const channel = primaryChannel(args.notify);
  // WhatsApp is manual; only an automated email send marks the customer notified.
  const customerNotified = args.notify.email;
  const fromStatus = order.status;

  try {
    await prisma.$transaction(async (tx) => {
      const updateData: Prisma.OrderUpdateInput = { status: args.toStatus };

      // `confirmedAt` is set once, on first confirm, and never cleared (FR-5).
      if (args.toStatus === "confirmed" && order.confirmedAt === null) {
        updateData.confirmedAt = new Date();
      }
      // Persist courier/tracking on the order for O(1) list/track access (FR-6).
      if (args.toStatus === "shipped" && args.shipping) {
        updateData.courierName = args.shipping.courierName;
        updateData.trackingNumber = args.shipping.trackingNumber;
        updateData.trackingUrl = args.shipping.trackingUrl ?? null;
      }

      await tx.order.update({ where: { id: order.id }, data: updateData });

      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          status: args.toStatus,
          note: eventNote,
          changedByAdminId: args.admin.id,
          channelNotified: channel,
          customerNotified,
        },
      });

      await writeAudit(
        {
          adminId: args.admin.id,
          action: "order.status_change",
          entityType: "Order",
          entityId: order.id,
          before: { status: fromStatus },
          after: {
            status: args.toStatus,
            ...(args.shipping
              ? {
                  courierName: args.shipping.courierName,
                  trackingNumber: args.shipping.trackingNumber,
                }
              : {}),
          },
        },
        tx,
      );
    });
  } catch (err) {
    console.error("[transitionOrderStatus] transaction failed", {
      orderId: order.id,
      toStatus: args.toStatus,
      err,
    });
    return fail("Could not update this order. Please try again.");
  }

  // ── Post-commit, best-effort side-effects (FR-42) ──
  if (args.notify.email) {
    // `notifyOrderStatusChange` reads the now-updated status + swallows errors.
    await notifyOrderStatusChange(order.id);
  }

  let whatsappUrl: string | undefined;
  if (args.notify.whatsapp) {
    const settings = await prisma.siteSetting
      .findUnique({
        where: { id: "singleton" },
        select: { storeName: true },
      })
      .catch(() => null);
    const link = buildStatusWhatsAppLink({
      customerPhone: order.customerPhone,
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      toStatus: args.toStatus,
      trackUrl: absoluteTrackUrl(order.trackingToken),
      courierName: args.shipping?.courierName,
      trackingNumber: args.shipping?.trackingNumber,
      trackingUrl: args.shipping?.trackingUrl,
      reason: args.reason,
      storeName: settings?.storeName ?? "GooglyWoogly Art",
    });
    if (link) whatsappUrl = link;
  }

  // Admin surfaces only — no storefront tags (FR-43). Refresh detail + list RSC.
  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/orders");

  return ok({ status: args.toStatus, whatsappUrl });
}

// ───────────────────────────── setPaymentStatus ─────────────────────────────

/**
 * Set an order's **payment** `paymentStatus` (docs/12 §6.2). Payment has NO
 * enforced transition graph (offline reality is non-linear, FR-9): any legal enum
 * value is accepted. Optionally records a paise `amountPaid` and an opt-in
 * `[Payment]`-prefixed timeline note (FR-10/FR-11). No customer email is sent on
 * a payment change (payment is a private WhatsApp matter, FR-10).
 */
export async function setPaymentStatus(
  input: z.infer<typeof setPaymentStatusSchema>,
): Promise<ActionResult<PaymentResult>> {
  const admin = await requireAdmin();

  const parsed = setPaymentStatusSchema.safeParse(input);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    select: { id: true, status: true, paymentStatus: true },
  });
  if (!order) return fail("Order not found.");

  const fromPayment = order.paymentStatus;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: data.paymentStatus,
          ...(data.amountPaid !== undefined ? { amountPaid: data.amountPaid } : {}),
        },
      });

      // Optional payment note shares the timeline but carries the *current*
      // fulfillment status (the event's status field is a fulfillment enum) and
      // is flagged `[Payment]` so the buyer-facing track view can hide it (FR-10).
      if (data.addTimelineNote && data.note?.trim()) {
        await tx.orderStatusEvent.create({
          data: {
            orderId: order.id,
            status: order.status,
            note: `[Payment] ${data.note.trim()}`,
            changedByAdminId: admin.id,
            channelNotified: null,
            customerNotified: false,
          },
        });
      }

      await writeAudit(
        {
          adminId: admin.id,
          action: "order.payment_change",
          entityType: "Order",
          entityId: order.id,
          before: { paymentStatus: fromPayment },
          after: {
            paymentStatus: data.paymentStatus,
            ...(data.amountPaid !== undefined ? { amountPaid: data.amountPaid } : {}),
          },
        },
        tx,
      );
    });
  } catch (err) {
    console.error("[setPaymentStatus] transaction failed", {
      orderId: order.id,
      paymentStatus: data.paymentStatus,
      err,
    });
    return fail("Could not update payment. Please try again.");
  }

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/orders");

  return ok({ paymentStatus: data.paymentStatus });
}

// ───────────────────────────── addInternalNote ─────────────────────────────

/**
 * Persist the admin-only `Order.internalNotes` (docs/12 §6.4 / FR-29). This is a
 * full-replacement save (the field is a single free-text blob, distinct from the
 * buyer-authored `customerNote`/`giftMessage`). Audited; never customer-visible.
 */
export async function addInternalNote(
  input: z.infer<typeof addInternalNoteSchema>,
): Promise<ActionResult<void>> {
  const admin = await requireAdmin();

  const parsed = addInternalNoteSchema.safeParse(input);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    select: { id: true, internalNotes: true },
  });
  if (!order) return fail("Order not found.");

  const nextNotes = data.internalNotes.trim() || null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { internalNotes: nextNotes },
      });
      await writeAudit(
        {
          adminId: admin.id,
          action: "order.notes_update",
          entityType: "Order",
          entityId: order.id,
          // `internalNotes` is admin-only context, not PII/secret — safe to log.
          before: { internalNotes: order.internalNotes },
          after: { internalNotes: nextNotes },
        },
        tx,
      );
    });
  } catch (err) {
    console.error("[addInternalNote] transaction failed", { orderId: order.id, err });
    return fail("Could not save the note. Please try again.");
  }

  revalidatePath(`/admin/orders/${order.id}`);

  return ok(undefined);
}
