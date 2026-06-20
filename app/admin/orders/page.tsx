import Link from "next/link";
import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { OrderStatus, PaymentStatus } from "@prisma/client";

import { requireAdmin } from "@/lib/auth";
import { adminListOrders, ADMIN_ORDERS_PAGE_SIZE } from "@/lib/services/orders";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants";
import { formatPaise } from "@/lib/money";
import { formatDateTimeIST } from "@/lib/format";
import { cn } from "@/lib/utils";

import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { Toolbar } from "@/components/admin/toolbar";
import { SearchInput } from "@/components/admin/search-input";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  AdminTable,
  AdminTableHeader,
  AdminTableHead,
  AdminTableBody,
  AdminTableRow,
  AdminTableCell,
} from "@/components/admin/admin-table";

import { OrderListFilters } from "./order-list-filters";

/**
 * Orders list (`/admin/orders`, docs/12 §3.5/§4.1). SSR, no full-page cache,
 * `noindex`. A filterable, searchable, paginated queue of every `Order`
 * newest-first. All filtering is server-side and URL-addressable via
 * `searchParams` (shareable links). Pending-confirmation rows are highlighted —
 * they're the founder's top priority (JTBD-1).
 *
 * Auth: `requireAdmin()` (all roles may view orders, docs/12 FR-41). Reads via
 * `adminListOrders` which returns full data (incl. drafts/archived) — fine, this
 * is admin-only; `costPrice` is never on an order.
 */

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

// Inherently dynamic (reads the session cookie + per-request filters).
export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

/** First value of a (possibly repeated) search param, trimmed. */
function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? "").trim();
  return (value ?? "").trim();
}

/** Coerce a raw param to a known `OrderStatus`, else undefined. */
function parseStatus(value: string): OrderStatus | undefined {
  return (Object.values(OrderStatus) as string[]).includes(value)
    ? (value as OrderStatus)
    : undefined;
}

/** Coerce a raw param to a known `PaymentStatus`, else undefined. */
function parsePaymentStatus(value: string): PaymentStatus | undefined {
  return (Object.values(PaymentStatus) as string[]).includes(value)
    ? (value as PaymentStatus)
    : undefined;
}

/** Parse a 1-based page number, defaulting to 1. */
function parsePage(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const status = parseStatus(firstParam(sp.status));
  const paymentStatus = parsePaymentStatus(firstParam(sp.payment));
  const query = firstParam(sp.q);
  const page = parsePage(firstParam(sp.page));

  const result = await adminListOrders({
    status,
    paymentStatus,
    query: query || undefined,
    page,
    pageSize: ADMIN_ORDERS_PAGE_SIZE,
  });

  const hasFilters = Boolean(status || paymentStatus || query);
  const isEmpty = result.items.length === 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Orders"
        description="Confirm, fulfil, and track every order."
      />

      <Toolbar>
        <SearchInput
          placeholder="Search order #, phone, email, or name…"
          ariaLabel="Search orders"
        />
        <OrderListFilters status={status} paymentStatus={paymentStatus} />
      </Toolbar>

      {isEmpty ? (
        <EmptyState
          icon={<ShoppingBag className="size-6" />}
          title={
            status === "pending_confirmation"
              ? "You're all caught up"
              : hasFilters
                ? "No orders match these filters"
                : "No orders yet"
          }
          description={
            status === "pending_confirmation"
              ? "No orders are awaiting confirmation right now."
              : hasFilters
                ? "Try clearing the search or status filters."
                : "Orders placed on the storefront will appear here."
          }
          action={
            hasFilters ? (
              <Link
                href="/admin/orders"
                className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-medium transition-colors hover:bg-pastel-pink/30"
              >
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Panel bodyClassName="p-0 sm:p-0">
          <AdminTable caption="Orders">
            <AdminTableHeader>
              <AdminTableHead>Order</AdminTableHead>
              <AdminTableHead>Date</AdminTableHead>
              <AdminTableHead>Customer</AdminTableHead>
              <AdminTableHead>Items</AdminTableHead>
              <AdminTableHead className="text-right">Total</AdminTableHead>
              <AdminTableHead>Status</AdminTableHead>
              <AdminTableHead>Payment</AdminTableHead>
            </AdminTableHeader>
            <AdminTableBody>
              {result.items.map((order) => {
                const statusMeta = ORDER_STATUS[order.status];
                const paymentMeta = PAYMENT_STATUS[order.paymentStatus];
                const isPending = order.status === "pending_confirmation";
                const firstItemTitle = order.items[0]?.productTitle;
                const itemCount = order._count.items;

                return (
                  <AdminTableRow
                    key={order.id}
                    className={cn(
                      "max-md:px-3",
                      // Highlight the founder's priority queue (JTBD-1, FR-21).
                      isPending &&
                        "bg-accent/20 hover:bg-accent/30 max-md:border-accent",
                    )}
                  >
                    <AdminTableCell label="Order">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </AdminTableCell>
                    <AdminTableCell
                      label="Date"
                      className="text-muted-foreground max-md:text-foreground"
                    >
                      <time dateTime={order.createdAt.toISOString()}>
                        {formatDateTimeIST(order.createdAt)}
                      </time>
                    </AdminTableCell>
                    <AdminTableCell label="Customer">
                      <span className="block max-w-[14rem] truncate">
                        {order.customerName}
                      </span>
                    </AdminTableCell>
                    <AdminTableCell
                      label="Items"
                      className="text-muted-foreground max-md:text-foreground"
                    >
                      <span className="block max-w-[16rem] truncate">
                        {itemCount} {itemCount === 1 ? "item" : "items"}
                        {firstItemTitle ? ` · ${firstItemTitle}` : ""}
                      </span>
                    </AdminTableCell>
                    <AdminTableCell
                      label="Total"
                      className="font-medium tabular-nums md:text-right"
                    >
                      {formatPaise(order.grandTotal)}
                    </AdminTableCell>
                    <AdminTableCell label="Status">
                      <StatusBadge tone={statusMeta.tone} label={statusMeta.label} />
                    </AdminTableCell>
                    <AdminTableCell label="Payment">
                      <StatusBadge tone={paymentMeta.tone} label={paymentMeta.label} />
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })}
            </AdminTableBody>
          </AdminTable>
        </Panel>
      )}

      {!isEmpty ? (
        <AdminPagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          basePath="/admin/orders"
          searchParams={sp}
        />
      ) : null}
    </div>
  );
}
