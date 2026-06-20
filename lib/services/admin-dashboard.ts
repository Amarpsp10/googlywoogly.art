import "server-only";

import { prisma } from "@/lib/db";
import {
  Prisma,
  type AdminRole,
  type OrderStatus,
  type PaymentStatus,
} from "@prisma/client";
import { deriveInventoryState, type InventoryState } from "@/lib/inventory";

/**
 * Dashboard read services (doc 10 §3.8, FR-37–FR-43). The dashboard is
 * **read-only and cache-free** (`force-dynamic`): every query here is a
 * **bounded, indexed** read of `Order` (by `status` + `createdAt`), `Product`
 * (low-stock filter), `AuditLog` (recent), `OrderStatusEvent` (recent) and the
 * two lead inboxes. It NEVER scans raw `AnalyticsEvent` — visitor/conversion
 * analytics arrive in Phase 5 and the page renders a "coming soon" placeholder
 * for those (CANON §12, doc 10 FR-43).
 *
 * Money stays in integer **paise** (CANON §10); `formatPaise` happens at the
 * display layer. Financial figures that reveal aggregate business performance
 * (revenue-requested) are **omitted from the query/DTO for `staff`** — not just
 * hidden in CSS (doc 10 FR-26). Order-level `grandTotal` is fine for all roles.
 */

/** Roles that may see aggregate revenue figures (doc 10 FR-26). */
function canSeeRevenue(role: AdminRole): boolean {
  return role !== "staff";
}

// ───────────────────────────── IST day windows ─────────────────────────────

/**
 * IST is a fixed UTC+05:30 offset (no DST). The "start of today in IST",
 * expressed as a UTC instant, is the most recent IST-midnight. We shift the
 * clock into IST, zero the time-of-day, then shift back — so KPI buckets line
 * up with the founder's calendar day, not the server's UTC day (CANON §10).
 */
const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

function startOfTodayIST(now: Date = new Date()): Date {
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const istMidnight = Date.UTC(
    istNow.getUTCFullYear(),
    istNow.getUTCMonth(),
    istNow.getUTCDate(),
  );
  return new Date(istMidnight - IST_OFFSET_MS);
}

/** Start of the IST day `days` days before today (inclusive lower bound). */
function startOfDaysAgoIST(days: number, now: Date = new Date()): Date {
  const start = startOfTodayIST(now);
  return new Date(start.getTime() - days * 86_400_000);
}

// ───────────────────────────────── KPIs ─────────────────────────────────

/** A single live KPI: order counts plus optional revenue (paise; null for staff). */
export interface DashboardKpis {
  ordersToday: number;
  orders7d: number;
  orders30d: number;
  /** Sum of `grandTotal` (paise) for the window — null when the role can't see revenue. */
  revenueRequested7d: number | null;
  revenueRequested30d: number | null;
  /** Whether revenue figures are included (false ⇒ staff: render a redaction note). */
  revenueVisible: boolean;
  /** Orders awaiting confirmation (mirrors the sidebar Orders badge). */
  pendingConfirmation: number;
  /** Products at/under threshold or out of stock (mirrors the Inventory badge). */
  lowStock: number;
  /** New bulk inquiries + new contact messages still in the inbox. */
  newLeads: number;
}

/**
 * Live dashboard KPIs (doc 10 FR-37 operational subset): order volume for
 * today / 7d / 30d, revenue-requested for 7d / 30d (sum of `grandTotal`,
 * **requested not collected** — CANON §1), the pending-confirmation count, the
 * low-stock count, and the new-leads count. All windows are IST-aligned.
 *
 * Visitor / conversion / AOV analytics are Phase 5 and are intentionally NOT
 * computed here (no `AnalyticsEvent`/`DailyMetricRollup` reads — FR-43).
 */
export async function getDashboardKpis(role: AdminRole): Promise<DashboardKpis> {
  const now = new Date();
  const todayStart = startOfTodayIST(now);
  const start7d = startOfDaysAgoIST(6, now); // today + previous 6 IST days = 7-day window
  const start30d = startOfDaysAgoIST(29, now);
  const revenueVisible = canSeeRevenue(role);

  // `countLowStock()` is a raw query wrapped in an async fn, so it can't ride in
  // the typed `$transaction([...])` tuple — run it alongside via `Promise.all`.
  const [
    [
      ordersToday,
      orders7d,
      orders30d,
      pendingConfirmation,
      newInquiries,
      newMessages,
    ],
    lowStock,
  ] = await Promise.all([
    prisma.$transaction([
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.count({ where: { createdAt: { gte: start7d } } }),
      prisma.order.count({ where: { createdAt: { gte: start30d } } }),
      prisma.order.count({ where: { status: "pending_confirmation" } }),
      prisma.bulkInquiry.count({ where: { status: "new" } }),
      prisma.contactMessage.count({ where: { status: "new" } }),
    ]),
    countLowStock(),
  ]);

  let revenueRequested7d: number | null = null;
  let revenueRequested30d: number | null = null;

  if (revenueVisible) {
    // Two narrow sums (not one grouped query) to stay index-friendly on
    // `createdAt` and keep each window trivially correct.
    const [revenue7dAgg, revenue30dAgg] = await prisma.$transaction([
      prisma.order.aggregate({
        where: { createdAt: { gte: start7d } },
        _sum: { grandTotal: true },
      }),
      prisma.order.aggregate({
        where: { createdAt: { gte: start30d } },
        _sum: { grandTotal: true },
      }),
    ]);
    revenueRequested7d = revenue7dAgg._sum.grandTotal ?? 0;
    revenueRequested30d = revenue30dAgg._sum.grandTotal ?? 0;
  }

  return {
    ordersToday,
    orders7d,
    orders30d,
    revenueRequested7d,
    revenueRequested30d,
    revenueVisible,
    pendingConfirmation,
    lowStock,
    newLeads: newInquiries + newMessages,
  };
}

// ─────────────────────────────── low stock ───────────────────────────────

/** A product needing stock attention (low-stock panel, doc 10 FR-39). */
export interface LowStockProduct {
  id: string;
  slug: string;
  title: string;
  sku: string;
  inventoryQuantity: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  /** Derived (never stored) — `low_stock` or `out_of_stock` here. */
  state: InventoryState;
}

/**
 * Shape returned by the low-stock raw query. `madeToOrder` is excluded by the
 * predicate, so derivation only ever yields `low_stock` / `out_of_stock`.
 */
interface LowStockRow {
  id: string;
  slug: string;
  title: string;
  sku: string;
  inventoryQuantity: number;
  lowStockThreshold: number;
  imageUrl: string | null;
}

/**
 * Count active, non-made-to-order products at/under their per-row threshold
 * (derived `low_stock`/`out_of_stock`, CANON §6; made-to-order excluded since
 * always orderable, doc 10 FR-39). Prisma can't compare two columns in `where`,
 * so we use a small raw count — identical predicate to `getLowStockProducts`.
 */
async function countLowStock(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "products"
    WHERE "status" = 'active'
      AND "madeToOrder" = false
      AND "inventoryQuantity" <= "lowStockThreshold"
  `;
  return Number(rows[0]?.count ?? 0);
}

/**
 * Low-stock products for the dashboard panel (doc 10 FR-39), most-urgent first
 * (lowest quantity). Bounded by `limit`. The derived state is computed in JS via
 * `deriveInventoryState` so the panel and the badge use the one CANON §6 rule.
 *
 * NOTE: the per-row `lowStockThreshold` comparison can't be expressed in the
 * Prisma query builder, so the candidate filter is a raw SQL `WHERE`; we join
 * the primary image via the snapshot `product_images` URL.
 */
export async function getLowStockProducts(limit = 5): Promise<LowStockProduct[]> {
  const take = Math.max(1, Math.trunc(limit));
  const rows = await prisma.$queryRaw<LowStockRow[]>`
    SELECT
      p."id",
      p."slug",
      p."title",
      p."sku",
      p."inventoryQuantity",
      p."lowStockThreshold",
      img."url" AS "imageUrl"
    FROM "products" p
    LEFT JOIN "product_images" img
      ON img."productId" = p."id" AND img."isPrimary" = true
    WHERE p."status" = 'active'
      AND p."madeToOrder" = false
      AND p."inventoryQuantity" <= p."lowStockThreshold"
    ORDER BY p."inventoryQuantity" ASC, p."title" ASC
    LIMIT ${take}
  `;

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    sku: r.sku,
    inventoryQuantity: r.inventoryQuantity,
    lowStockThreshold: r.lowStockThreshold,
    imageUrl: r.imageUrl,
    state: deriveInventoryState({
      madeToOrder: false,
      inventoryQuantity: r.inventoryQuantity,
      lowStockThreshold: r.lowStockThreshold,
    }),
  }));
}

// ───────────────────────────── pending orders ─────────────────────────────

/** A row in the pending-orders queue (doc 10 FR-38). */
export interface PendingOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  itemCount: number;
  grandTotal: number; // paise — visible to all roles
  paymentStatus: PaymentStatus;
  createdAt: Date;
}

const pendingOrderSelect = {
  id: true,
  orderNumber: true,
  customerName: true,
  grandTotal: true,
  paymentStatus: true,
  createdAt: true,
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;

/**
 * The pending-confirmation queue (doc 10 FR-38): orders awaiting confirmation,
 * newest first, bounded by `limit`. Each row deep-links to its admin detail
 * page. `grandTotal` is intentionally exposed to every role (fulfilment context,
 * FR-26) — only *aggregate* revenue is staff-redacted.
 */
export async function getPendingOrders(limit = 5): Promise<PendingOrder[]> {
  const take = Math.max(1, Math.trunc(limit));
  const rows = await prisma.order.findMany({
    where: { status: "pending_confirmation" },
    select: pendingOrderSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
  });

  return rows.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    itemCount: o._count.items,
    grandTotal: o.grandTotal,
    paymentStatus: o.paymentStatus,
    createdAt: o.createdAt,
  }));
}

// ───────────────────────────── recent activity ─────────────────────────────

/** A unified, human-readable activity entry (doc 10 FR-40). */
export interface ActivityItem {
  /** Stable key for React + de-dupe (`audit:<id>` / `event:<id>`). */
  key: string;
  /** Pre-composed human sentence, e.g. "Vanshika confirmed order GW-2026-00042". */
  message: string;
  /** Who acted (admin name) — null for system/customer-driven events. */
  actor: string | null;
  /** In-app link to the affected entity (or null when none applies). */
  href: string | null;
  createdAt: Date;
}

/** Audit rows projected for the feed (PII already redacted at write time). */
const activityAuditSelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  createdAt: true,
  admin: { select: { name: true } },
} satisfies Prisma.AuditLogSelect;

/** Status-event rows projected for the feed. */
const activityEventSelect = {
  id: true,
  status: true,
  createdAt: true,
  order: { select: { id: true, orderNumber: true } },
  changedBy: { select: { name: true } },
} satisfies Prisma.OrderStatusEventSelect;

/**
 * Audit actions a `staff` member must NOT see in the feed (doc 10 FR-40): the
 * financial / configuration / accountability surfaces they have no access to.
 * Matching is by `action` prefix so future verbs stay covered.
 */
const STAFF_HIDDEN_AUDIT_PREFIXES = [
  "site_setting.",
  "admin_user.",
  "coupon.",
  "auth.",
] as const;

function isStaffVisibleAudit(action: string): boolean {
  return !STAFF_HIDDEN_AUDIT_PREFIXES.some((p) => action.startsWith(p));
}

/** Map an `entityType` to its admin route (best-effort; null when unmapped). */
function hrefForEntity(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "Order":
      return `/admin/orders/${entityId}`;
    case "Product":
      return `/admin/products/${entityId}`;
    case "Category":
      return `/admin/categories`;
    case "Collection":
      return `/admin/collections`;
    case "BulkInquiry":
      return `/admin/bulk-inquiries`;
    case "ContactMessage":
      return `/admin/messages`;
    case "Review":
      return `/admin/reviews`;
    default:
      return null;
  }
}

/** Human label for an audit `"{entity}.{verb}"` action, e.g. "updated product". */
function describeAuditAction(action: string, entityType: string): string {
  const verb = action.includes(".") ? action.slice(action.indexOf(".") + 1) : action;
  const entity = entityType.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  const VERB_LABEL: Record<string, string> = {
    create: "created",
    update: "updated",
    delete: "deleted",
    archive: "archived",
    publish: "published",
    unpublish: "unpublished",
    reorder: "reordered",
    status_change: "changed the status of",
    payment_change: "updated payment on",
    moderate: "moderated",
    role_change: "changed the role on",
  };
  const label = VERB_LABEL[verb] ?? verb.replace(/_/g, " ");
  return `${label} ${entity}`;
}

/**
 * Recent-activity feed (doc 10 FR-40): a reverse-chronological merge of recent
 * `AuditLog` entries (joined to the acting admin) and recent `OrderStatusEvent`s,
 * each rendered as a human sentence and linked to its entity. Owner/admin see
 * everything; `staff` see only entries they're permitted to see (no
 * settings/price/team/auth rows — FR-40/FR-26).
 *
 * We over-fetch each source by `limit`, merge, sort, then slice — so the final
 * list is the true newest `limit` across both sources.
 */
export async function getRecentActivity(
  role: AdminRole,
  limit = 8,
): Promise<ActivityItem[]> {
  const take = Math.max(1, Math.trunc(limit));

  const [auditRows, eventRows] = await prisma.$transaction([
    prisma.auditLog.findMany({
      select: activityAuditSelect,
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.orderStatusEvent.findMany({
      select: activityEventSelect,
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);

  const staff = !canSeeRevenue(role); // staff === !revenue-visible per the matrix

  const fromAudit: ActivityItem[] = auditRows
    .filter((row) => !staff || isStaffVisibleAudit(row.action))
    .map((row) => {
      const actor = row.admin?.name ?? null;
      const phrase = describeAuditAction(row.action, row.entityType);
      const who = actor ?? "Someone";
      return {
        key: `audit:${row.id}`,
        message: `${who} ${phrase}`,
        actor,
        href: hrefForEntity(row.entityType, row.entityId),
        createdAt: row.createdAt,
      };
    });

  const fromEvents: ActivityItem[] = eventRows.map((row) => {
    const actor = row.changedBy?.name ?? null;
    const who = actor ?? "System";
    const orderNo = row.order?.orderNumber ?? "an order";
    const statusLabel = ORDER_STATUS_VERB[row.status] ?? row.status.replace(/_/g, " ");
    return {
      key: `event:${row.id}`,
      message: `${who} marked order ${orderNo} ${statusLabel}`,
      actor,
      href: row.order ? `/admin/orders/${row.order.id}` : null,
      createdAt: row.createdAt,
    };
  });

  return [...fromAudit, ...fromEvents]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, take);
}

/** Past-tense status phrasing for the activity feed, e.g. "marked … confirmed". */
const ORDER_STATUS_VERB: Record<OrderStatus, string> = {
  pending_confirmation: "pending confirmation",
  confirmed: "confirmed",
  in_production: "in production",
  ready_to_ship: "ready to ship",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
  on_hold: "on hold",
};
