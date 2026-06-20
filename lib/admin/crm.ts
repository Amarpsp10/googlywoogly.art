import "server-only";

import {
  Prisma,
  type AdminRole,
  type ReviewStatus,
  type OrderStatus,
  type PaymentStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { hidesFinancials } from "@/lib/auth";

/**
 * Admin reads for the **derived CRM** surfaces that have no dedicated service
 * module: the `Customer` list/detail (doc 12 §5.2 — read-only here; counters are
 * owned by order placement) and the product `Review` moderation queue (V1).
 *
 * Bulk inquiries / contact messages already have reads in
 * `@/lib/services/leads` (`adminListBulkInquiries` / `adminListContactMessages`)
 * and are not duplicated here.
 *
 * Financial redaction (doc 10 FR-26): `Customer.totalRequested` reveals
 * cross-order aggregate spend and is therefore **omitted from the DTO** for
 * `staff` — not merely hidden in CSS. Pass the viewer's role so the projection
 * can drop it server-side.
 */

// ───────────────────────────── customers ─────────────────────────────

export const ADMIN_CUSTOMERS_PAGE_SIZE = 25;

/** Paginated result envelope (mirrors the orders service `Paginated<T>`). */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminListCustomersFilter {
  /** Free text: matches name / phone / email (case-insensitive). */
  query?: string;
  page?: number;
  pageSize?: number;
}

/**
 * A customer row for the admin list. `totalRequested` is `number | null` —
 * `null` when redacted for `staff` (doc 10 FR-26) so the UI can render an em-dash
 * without a separate role check.
 */
export interface AdminCustomerListItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  ordersCount: number;
  /** Lifetime requested value in paise; null when redacted for staff. */
  totalRequested: number | null;
  tags: string[];
  lastOrderAt: Date | null;
}

function buildCustomerWhere(
  filter: AdminListCustomersFilter,
): Prisma.CustomerWhereInput {
  const q = filter.query?.trim();
  if (!q) return {};
  return {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
    ],
  };
}

/**
 * Admin customer list — most-recently-active first (those who never ordered
 * sort last via the nulls-last `lastOrderAt`, then by creation). Server-side
 * filtered + paginated; `totalRequested` is stripped for `staff`.
 */
export async function adminListCustomers(
  role: AdminRole,
  filter: AdminListCustomersFilter = {},
): Promise<Paginated<AdminCustomerListItem>> {
  const page = Math.max(1, Math.trunc(filter.page ?? 1));
  const pageSize = Math.max(
    1,
    Math.trunc(filter.pageSize ?? ADMIN_CUSTOMERS_PAGE_SIZE),
  );
  const where = buildCustomerWhere(filter);
  const redactMoney = hidesFinancials(role);

  const [total, rows] = await prisma.$transaction([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        ordersCount: true,
        totalRequested: true,
        tags: true,
        lastOrderAt: true,
      },
      orderBy: [{ lastOrderAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items: AdminCustomerListItem[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    ordersCount: c.ordersCount,
    totalRequested: redactMoney ? null : c.totalRequested,
    tags: c.tags,
    lastOrderAt: c.lastOrderAt,
  }));

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** One order in the customer's history (newest first on the detail). */
export interface AdminCustomerOrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  grandTotal: number;
  createdAt: Date;
  _count: { items: number };
}

/** Full customer detail for `/admin/customers/[id]` (CRM + order history). */
export interface AdminCustomerDetail {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  ordersCount: number;
  /** Lifetime requested value in paise; null when redacted for staff. */
  totalRequested: number | null;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  tags: string[];
  notes: string | null;
  createdAt: Date;
  orders: AdminCustomerOrderSummary[];
}

/**
 * Full customer detail by id: CRM fields plus their orders (newest first).
 * Returns null when not found. `totalRequested` is stripped for `staff`.
 */
export async function adminGetCustomerById(
  role: AdminRole,
  id: string,
): Promise<AdminCustomerDetail | null> {
  if (!id) return null;
  const c = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      ordersCount: true,
      totalRequested: true,
      firstOrderAt: true,
      lastOrderAt: true,
      tags: true,
      notes: true,
      createdAt: true,
      orders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          grandTotal: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
  });
  if (!c) return null;

  return {
    ...c,
    totalRequested: hidesFinancials(role) ? null : c.totalRequested,
  };
}

// ───────────────────────────── reviews (V1) ─────────────────────────────

export const ADMIN_REVIEWS_PAGE_SIZE = 25;

export interface AdminListReviewsFilter {
  /** Defaults to `pending` (the moderation queue). */
  status?: ReviewStatus;
  page?: number;
  pageSize?: number;
}

/** A review row for the moderation queue, with the parent product's slug/title. */
export interface AdminReviewListItem {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  createdAt: Date;
}

/**
 * Admin review moderation list — defaults to the `pending` queue, oldest first
 * (FIFO moderation). Joins the parent product so the queue card can link to the
 * PDP and the moderate action can revalidate `product:{slug}`.
 */
export async function adminListReviews(
  filter: AdminListReviewsFilter = {},
): Promise<Paginated<AdminReviewListItem>> {
  const status = filter.status ?? "pending";
  const page = Math.max(1, Math.trunc(filter.page ?? 1));
  const pageSize = Math.max(
    1,
    Math.trunc(filter.pageSize ?? ADMIN_REVIEWS_PAGE_SIZE),
  );
  const where: Prisma.ReviewWhereInput = { status };

  const [total, rows] = await prisma.$transaction([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      select: {
        id: true,
        productId: true,
        customerName: true,
        rating: true,
        title: true,
        body: true,
        status: true,
        isVerifiedPurchase: true,
        createdAt: true,
        product: { select: { title: true, slug: true } },
      },
      // Pending: oldest first (clear the backlog FIFO). Decided lists: newest first.
      orderBy: { createdAt: status === "pending" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items: AdminReviewListItem[] = rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    productTitle: r.product.title,
    productSlug: r.product.slug,
    customerName: r.customerName,
    rating: r.rating,
    title: r.title,
    body: r.body,
    status: r.status,
    isVerifiedPurchase: r.isVerifiedPurchase,
    createdAt: r.createdAt,
  }));

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ───────────────────────────── shared: assignable admins ─────────────────────────────

/** A minimal admin option for the inquiry "assign to" select. */
export interface AssignableAdmin {
  id: string;
  name: string;
  role: AdminRole;
}

/**
 * Active admins that a bulk inquiry can be assigned to (doc 12 leads — assign).
 * PII-light: id + name + role only.
 */
export async function listAssignableAdmins(): Promise<AssignableAdmin[]> {
  return prisma.adminUser.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}
