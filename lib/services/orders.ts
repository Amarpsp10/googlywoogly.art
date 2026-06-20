import "server-only";

import { prisma } from "@/lib/db";
import { Prisma, type OrderStatus, type PaymentStatus } from "@prisma/client";
import type { Address } from "@/types";

/**
 * Order **read** services (CANON `12`). Placement/mutation lives in later phases;
 * this module only reads. Two audiences with different data exposure:
 *
 *  - Public tracking (`/track/[token]`, `08` FR-40 / `12` FR-32–FR-34): looked up
 *    by `trackingToken` only and returned as a **deliberately redacted** DTO via
 *    `toTrackingDTO()` — the page never receives the raw `Order` (no phone/email,
 *    no full street address, no internal/admin fields).
 *  - Admin (`/admin/orders`, `/admin/orders/[id]`, `12` FR-20/FR-26): full order
 *    with items, ordered status events, and the linked customer.
 *
 * Money stays in **paise**; formatting (`formatPaise`) and IST date formatting
 * happen at the display layer, never here.
 */

// ───────────────────────────── public tracking ─────────────────────────────

/**
 * Columns safe to read for the customer-facing tracking page (`12` FR-34).
 * NOTE: `shippingAddress` is a JSONB blob (all-or-nothing in Prisma) containing
 * PII — it is selected here only so `toTrackingDTO` can coarsen it to
 * city/state/pincode. Callers MUST go through `toTrackingDTO` and never return
 * the raw payload to the client.
 */
export const trackingOrderSelect = {
  orderNumber: true,
  status: true,
  paymentStatus: true,
  shippingAddress: true,
  subtotal: true,
  shippingFee: true,
  discountTotal: true,
  taxTotal: true,
  grandTotal: true,
  courierName: true,
  trackingNumber: true,
  trackingUrl: true,
  createdAt: true,
  items: {
    select: {
      productId: true,
      productTitle: true,
      sku: true,
      imageUrl: true,
      unitPrice: true,
      quantity: true,
      lineTotal: true,
      personalizationNote: true,
      giftMessage: true,
      madeToOrderSnapshot: true,
      productionLeadTimeDaysSnapshot: true,
    },
    orderBy: { lineTotal: "desc" },
  },
  statusEvents: {
    select: {
      status: true,
      note: true,
      channelNotified: true,
      customerNotified: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.OrderSelect;

type TrackingOrderRow = Prisma.OrderGetPayload<{ select: typeof trackingOrderSelect }>;

/** Coarse shipping area shown on `/track` to recognise the order (FR-34). */
export interface CoarseShippingArea {
  city: string;
  state: string;
  pincode: string;
}

/** A redacted timeline entry (no actor, raw note kept for public render filtering). */
export interface TrackingStatusEvent {
  status: OrderStatus;
  note: string | null;
  channelNotified: TrackingOrderRow["statusEvents"][number]["channelNotified"];
  customerNotified: boolean;
  createdAt: Date;
}

/** Redacted projection sent to the tracking page (no PII; `12` FR-34). */
export interface TrackingDTO {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  /** Coarse area only — never full street/phone/email. */
  shippingArea: CoarseShippingArea | null;
  subtotal: number;
  shippingFee: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  createdAt: Date;
  items: Array<{
    productId: string | null;
    productTitle: string;
    sku: string;
    imageUrl: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    personalizationNote: string | null;
    giftMessage: string | null;
    madeToOrder: boolean;
    productionLeadTimeDays: number | null;
  }>;
  statusEvents: TrackingStatusEvent[];
}

/**
 * Narrow the JSONB shipping address to a coarse {city,state,pincode}. Returns
 * null if the stored shape is unexpected — never throws, never leaks line1/phone.
 */
function toCoarseShippingArea(value: Prisma.JsonValue | null): CoarseShippingArea | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const addr = value as Partial<Address>;
  if (
    typeof addr.city !== "string" ||
    typeof addr.state !== "string" ||
    typeof addr.pincode !== "string"
  ) {
    return null;
  }
  return { city: addr.city, state: addr.state, pincode: addr.pincode };
}

/** Map a raw tracking row to the redacted DTO (drops PII; coarsens address). */
export function toTrackingDTO(row: TrackingOrderRow): TrackingDTO {
  return {
    orderNumber: row.orderNumber,
    status: row.status,
    paymentStatus: row.paymentStatus,
    shippingArea: toCoarseShippingArea(row.shippingAddress),
    subtotal: row.subtotal,
    shippingFee: row.shippingFee,
    discountTotal: row.discountTotal,
    taxTotal: row.taxTotal,
    grandTotal: row.grandTotal,
    courierName: row.courierName,
    trackingNumber: row.trackingNumber,
    trackingUrl: row.trackingUrl,
    createdAt: row.createdAt,
    items: row.items.map((it) => ({
      productId: it.productId,
      productTitle: it.productTitle,
      sku: it.sku,
      imageUrl: it.imageUrl,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      lineTotal: it.lineTotal,
      personalizationNote: it.personalizationNote,
      giftMessage: it.giftMessage,
      madeToOrder: it.madeToOrderSnapshot,
      productionLeadTimeDays: it.productionLeadTimeDaysSnapshot,
    })),
    statusEvents: row.statusEvents.map((e) => ({
      status: e.status,
      note: e.note,
      channelNotified: e.channelNotified,
      customerNotified: e.customerNotified,
      createdAt: e.createdAt,
    })),
  };
}

/**
 * Look up an order for the public tracking page by its opaque `trackingToken`
 * (the only accepted key — never orderNumber/id/phone). Returns a redacted DTO,
 * or `null` for an unknown token so the caller renders a generic not-found with
 * no existence leak (`12` FR-32).
 */
export async function getOrderByTrackingToken(token: string): Promise<TrackingDTO | null> {
  if (!token) return null;
  const row = await prisma.order.findUnique({
    where: { trackingToken: token },
    select: trackingOrderSelect,
  });
  return row ? toTrackingDTO(row) : null;
}

// ───────────────────────────── admin reads ─────────────────────────────

/** Row shape for the admin orders list (`12` FR-22). */
export const adminOrderListSelect = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  grandTotal: true,
  source: true,
  createdAt: true,
  _count: { select: { items: true } },
  items: { select: { productTitle: true }, take: 1, orderBy: { lineTotal: "desc" } },
} satisfies Prisma.OrderSelect;

export type AdminOrderListItem = Prisma.OrderGetPayload<{ select: typeof adminOrderListSelect }>;

/** Full admin order detail (`12` FR-26). */
export const adminOrderDetailSelect = {
  id: true,
  orderNumber: true,
  trackingToken: true,
  status: true,
  paymentStatus: true,
  customerId: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  shippingAddress: true,
  billingAddress: true,
  subtotal: true,
  shippingFee: true,
  discountTotal: true,
  taxTotal: true,
  grandTotal: true,
  amountPaid: true,
  currency: true,
  couponCode: true,
  customerNote: true,
  giftMessage: true,
  source: true,
  courierName: true,
  trackingNumber: true,
  trackingUrl: true,
  invoiceNumber: true,
  internalNotes: true,
  confirmedAt: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      productId: true,
      productTitle: true,
      sku: true,
      imageUrl: true,
      unitPrice: true,
      quantity: true,
      lineTotal: true,
      personalizationNote: true,
      giftMessage: true,
      madeToOrderSnapshot: true,
      productionLeadTimeDaysSnapshot: true,
    },
    orderBy: { lineTotal: "desc" },
  },
  statusEvents: {
    select: {
      id: true,
      status: true,
      note: true,
      changedByAdminId: true,
      changedBy: { select: { id: true, name: true } },
      channelNotified: true,
      customerNotified: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  },
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      ordersCount: true,
      totalRequested: true,
      tags: true,
    },
  },
} satisfies Prisma.OrderSelect;

export type AdminOrderDetail = Prisma.OrderGetPayload<{ select: typeof adminOrderDetailSelect }>;

/** Filters for the admin orders list (`12` FR-21). */
export interface AdminListOrdersFilter {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  /** Free text: matches orderNumber (prefix), phone, email, or name. */
  query?: string;
  /** 1-based page; defaults to 1. */
  page?: number;
  /** Page size; defaults to ADMIN_ORDERS_PAGE_SIZE. */
  pageSize?: number;
}

/** Default admin orders page size (`12` FR-21: page size 25). */
export const ADMIN_ORDERS_PAGE_SIZE = 25;

/** Paginated result envelope for admin lists. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Build the `where` clause from the admin list filter. Exported so the
 * (future) count/export paths can reuse the exact same predicate.
 */
export function buildAdminOrderWhere(
  filter: AdminListOrdersFilter,
): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.paymentStatus) where.paymentStatus = filter.paymentStatus;

  const q = filter.query?.trim();
  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: q } },
      { customerEmail: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

/**
 * Admin orders list — newest first, server-side filtered + paginated
 * (`12` FR-20/FR-21). Returns the page plus total/page-count for the pager.
 */
export async function adminListOrders(
  filter: AdminListOrdersFilter = {},
): Promise<Paginated<AdminOrderListItem>> {
  const page = Math.max(1, Math.trunc(filter.page ?? 1));
  const pageSize = Math.max(1, Math.trunc(filter.pageSize ?? ADMIN_ORDERS_PAGE_SIZE));
  const where = buildAdminOrderWhere(filter);

  const [total, items] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: adminOrderListSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Full admin order detail by internal id (`12` FR-26): order + frozen items +
 * ordered status-event timeline + linked customer. Returns null if not found.
 */
export async function adminGetOrderById(id: string): Promise<AdminOrderDetail | null> {
  if (!id) return null;
  return prisma.order.findUnique({
    where: { id },
    select: adminOrderDetailSelect,
  });
}
