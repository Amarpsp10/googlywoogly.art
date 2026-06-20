"use server";

import { Prisma, OrderStatus, PaymentStatus, OrderSource } from "@prisma/client";
import { headers } from "next/headers";

import { prisma } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { ok, fail, failValidation, type ActionResult } from "@/lib/result";
import { checkoutSchema, type CheckoutInput } from "@/lib/validations/checkout";
import { computeCartTotals } from "@/lib/services/pricing";
import { getShippingDefaults } from "@/lib/services/settings";
import { formatOrderNumber, generateTrackingToken } from "@/lib/order-number";
import { notifyOrderPlaced } from "@/lib/email";
import {
  buildOrderLines,
  type OrderProductSnapshot,
  type OrderLineSnapshot,
} from "@/lib/order-lines";
import type { Address, ShippingDefaults } from "@/types";

/**
 * `placeOrder` — the storefront's single order-write path (CANON `03` §6; doc
 * `08` §6.3/§6.5; doc `12`). Invoked as a Server Action from `/checkout`.
 *
 * Security & correctness contract:
 *  - **Never trusts client money.** The cart's `unitPrice` is advisory; the
 *    authoritative price is re-read from `Product.price` here and every total is
 *    recomputed server-side via `computeCartTotals`.
 *  - **Idempotent** against double-submit/retry via the unique
 *    `Order.clientRequestId`: a duplicate request returns the original
 *    `{ orderNumber, trackingToken }` instead of creating a second order.
 *  - **Stock is validated, never decremented** (CANON §16 R-9: stock is
 *    admin-managed). Non-made-to-order lines require `inventoryQuantity >= qty`;
 *    made-to-order lines are always orderable.
 *  - The DB write (Counter + Customer + Order + items + initial status event) is
 *    one atomic `$transaction`. Emails run **after** commit and are fire-and-
 *    forget — a notification failure can never roll back the order.
 *
 * This file carries the `"use server"` directive, so it exports ONLY the async
 * `placeOrder`. The pure, testable line builder lives in `@/lib/order-lines`.
 */

// ───────────────────────────── messages ─────────────────────────────

const EMPTY_CART_ERROR = "Your cart is empty.";
const GENERIC_ERROR = "We couldn't confirm your order. Please try again.";
const RATE_LIMITED =
  "You're placing orders very quickly. Please wait a moment and try again.";

/**
 * Order-placement throttle (docs/16 FR-23): 20 attempts / 10 min per IP —
 * generous enough to absorb legitimate retries and idempotent double-submits,
 * tight enough to blunt scripted abuse of the single storefront write path.
 */
const ORDER_RATE = { limit: 20, windowMs: 10 * 60_000 };

/**
 * Fallback shipping config when `SiteSetting.shippingDefaults` is unset (matches
 * the seed + cart page defaults).
 */
const DEFAULT_SHIPPING: ShippingDefaults = {
  flatRatePaise: 7900,
  freeShippingThresholdPaise: 150000,
  codEnabled: false,
};

// ───────────────────────────── helpers ─────────────────────────────

/** IST calendar year for the `order:{YYYY}` counter + order number. */
function istYear(now: Date = new Date()): number {
  const ist = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
  }).format(now);
  return Number(ist);
}

/**
 * Normalize a phone for the `Customer.phone` identity key. The checkout schema
 * already pipes contact/address phones to a bare 10-digit `[6-9]\d{9}` form; we
 * prefix the `91` country code so the stored key is stable and WhatsApp-ready.
 */
function normalizeCustomerPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return `91${digits}`;
}

// ───────────────────────────── placeOrder ─────────────────────────────

export async function placeOrder(
  input: CheckoutInput,
): Promise<ActionResult<{ orderNumber: string; trackingToken: string }>> {
  // 0) Abuse control: per-IP throttle before any DB work. Friendly fail (never
  //    throws); generous limit so normal retries / idempotent re-submits pass.
  const ip = clientIp(await headers());
  if (!rateLimit(`order:${ip}`, ORDER_RATE).ok) {
    return fail(RATE_LIMITED);
  }

  // 1) Re-validate server-side — the schema is the source of truth.
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  // 2) Idempotency: a duplicate submission (same clientRequestId) returns the
  //    original order rather than creating a second.
  if (data.clientRequestId) {
    const existing = await prisma.order.findUnique({
      where: { clientRequestId: data.clientRequestId },
      select: { orderNumber: true, trackingToken: true },
    });
    if (existing) {
      return ok({
        orderNumber: existing.orderNumber,
        trackingToken: existing.trackingToken,
      });
    }
  }

  // 3) Load the referenced products (active only) and re-price authoritatively.
  const productIds = Array.from(new Set(data.items.map((i) => i.productId)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, status: "active" },
    select: {
      id: true,
      price: true,
      sku: true,
      title: true,
      inventoryQuantity: true,
      madeToOrder: true,
      productionLeadTimeDays: true,
      primaryImage: { select: { url: true } },
    },
  });

  const productsById = new Map<string, OrderProductSnapshot>(
    products.map((p) => [
      p.id,
      {
        id: p.id,
        price: p.price,
        sku: p.sku,
        title: p.title,
        inventoryQuantity: p.inventoryQuantity,
        madeToOrder: p.madeToOrder,
        productionLeadTimeDays: p.productionLeadTimeDays,
        primaryImageUrl: p.primaryImage?.url ?? null,
      },
    ]),
  );

  const built = buildOrderLines(data.items, productsById);
  if (!built.ok) {
    return fail(built.error);
  }
  if (built.lines.length === 0) {
    return fail(EMPTY_CART_ERROR);
  }

  // 4) Server recomputes all money — client totals are ignored.
  const shipping = (await getShippingDefaults()) ?? DEFAULT_SHIPPING;
  const totals = computeCartTotals(built.pricedLines, shipping);

  const contact = data.contact;
  const shippingAddress = data.shippingAddress as Address;
  const customerPhone = normalizeCustomerPhone(contact.customerPhone);
  const year = istYear();
  const now = new Date();

  // 5) Atomic placement transaction with a single tracking-token-collision retry.
  let order: { id: string; orderNumber: string; trackingToken: string };
  try {
    order = await placeOrderTransaction({
      year,
      now,
      contact,
      customerPhone,
      shippingAddress,
      lines: built.lines,
      totals,
      customerNote: data.customerNote ?? null,
      giftMessage: data.giftMessage ?? null,
      clientRequestId: data.clientRequestId ?? null,
    });
  } catch (err) {
    // A racing duplicate (same clientRequestId) may lose the unique-insert race
    // between our pre-check and the insert — resolve it idempotently.
    if (
      data.clientRequestId &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const existing = await prisma.order.findUnique({
        where: { clientRequestId: data.clientRequestId },
        select: { orderNumber: true, trackingToken: true },
      });
      if (existing) {
        return ok({
          orderNumber: existing.orderNumber,
          trackingToken: existing.trackingToken,
        });
      }
    }
    console.error(
      "[placeOrder] transaction failed:",
      err instanceof Error ? err.message : String(err),
    );
    return fail(GENERIC_ERROR);
  }

  // 6) Post-commit side effect: placement emails (customer + admin). Fire-and-
  //    forget — `notifyOrderPlaced` already swallows + logs, but we still guard.
  try {
    await notifyOrderPlaced(order.id);
  } catch (err) {
    console.error(
      `[placeOrder] notifyOrderPlaced failed for order ${order.orderNumber}:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  return ok({ orderNumber: order.orderNumber, trackingToken: order.trackingToken });
}

// ───────────────────────────── transaction ─────────────────────────────

interface PlaceOrderTxArgs {
  year: number;
  now: Date;
  contact: CheckoutInput["contact"];
  customerPhone: string;
  shippingAddress: Address;
  lines: OrderLineSnapshot[];
  totals: ReturnType<typeof computeCartTotals>;
  customerNote: string | null;
  giftMessage: string | null;
  clientRequestId: string | null;
}

/**
 * Run the atomic placement transaction once. Bumps the per-year `Counter`, upserts
 * the `Customer` by normalized phone, and creates the `Order` with nested items +
 * an initial `OrderStatusEvent`.
 */
async function runPlaceOrderTransaction(
  args: PlaceOrderTxArgs,
  trackingToken: string,
): Promise<{ id: string; orderNumber: string; trackingToken: string }> {
  const {
    year,
    now,
    contact,
    customerPhone,
    shippingAddress,
    lines,
    totals,
    customerNote,
    giftMessage,
    clientRequestId,
  } = args;

  return prisma.$transaction(async (tx) => {
    const counter = await tx.counter.upsert({
      where: { key: `order:${year}` },
      create: { key: `order:${year}`, value: 1 },
      update: { value: { increment: 1 } },
      select: { value: true },
    });
    const orderNumber = formatOrderNumber(year, counter.value);

    await tx.customer.upsert({
      where: { phone: customerPhone },
      create: {
        name: contact.customerName,
        phone: customerPhone,
        email: contact.customerEmail,
        ordersCount: 1,
        totalRequested: totals.grandTotal,
        firstOrderAt: now,
        lastOrderAt: now,
      },
      update: {
        name: contact.customerName,
        email: contact.customerEmail,
        ordersCount: { increment: 1 },
        totalRequested: { increment: totals.grandTotal },
        lastOrderAt: now,
      },
      select: { id: true },
    });

    const created = await tx.order.create({
      data: {
        orderNumber,
        trackingToken,
        clientRequestId,
        status: OrderStatus.pending_confirmation,
        paymentStatus: PaymentStatus.unpaid,
        source: OrderSource.web_checkout,
        currency: "INR",
        customer: { connect: { phone: customerPhone } },
        customerName: contact.customerName,
        customerPhone,
        customerEmail: contact.customerEmail,
        shippingAddress: shippingAddress as unknown as Prisma.InputJsonValue,
        subtotal: totals.subtotal,
        shippingFee: totals.shippingFee,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        customerNote,
        giftMessage,
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            productTitle: l.productTitle,
            sku: l.sku,
            imageUrl: l.imageUrl,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            lineTotal: l.lineTotal,
            personalizationNote: l.personalizationNote,
            giftMessage: l.giftMessage,
            madeToOrderSnapshot: l.madeToOrderSnapshot,
            productionLeadTimeDaysSnapshot: l.productionLeadTimeDaysSnapshot,
          })),
        },
        statusEvents: {
          create: {
            status: OrderStatus.pending_confirmation,
            note: "Order placed",
            customerNotified: false,
          },
        },
      },
      select: { id: true, orderNumber: true, trackingToken: true },
    });

    return created;
  });
}

/**
 * Execute the placement transaction with one retry if the generated
 * `trackingToken` collides (astronomically unlikely). Any other error
 * (including a `clientRequestId` unique violation) propagates to the caller.
 */
async function placeOrderTransaction(
  args: PlaceOrderTxArgs,
): Promise<{ id: string; orderNumber: string; trackingToken: string }> {
  try {
    return await runPlaceOrderTransaction(args, generateTrackingToken());
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      isTrackingTokenTarget(err.meta?.target)
    ) {
      return runPlaceOrderTransaction(args, generateTrackingToken());
    }
    throw err;
  }
}

/** True when a P2002 unique violation is on the `trackingToken` column. */
function isTrackingTokenTarget(target: unknown): boolean {
  if (Array.isArray(target)) return target.includes("trackingToken");
  return typeof target === "string" && target.includes("trackingToken");
}
