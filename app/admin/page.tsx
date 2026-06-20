import Link from "next/link";
import type { Metadata } from "next";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Boxes,
  ClipboardCheck,
  Inbox,
  PackagePlus,
  ShoppingBag,
  TriangleAlert,
} from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { formatPaise } from "@/lib/money";
import { formatDateTimeIST } from "@/lib/format";
import { INVENTORY_STATE, PAYMENT_STATUS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  getDashboardKpis,
  getLowStockProducts,
  getPendingOrders,
  getRecentActivity,
  type ActivityItem,
  type LowStockProduct,
  type PendingOrder,
} from "@/lib/services/admin-dashboard";

import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { buttonVariants } from "@/components/ui/button";

/**
 * Admin dashboard home (doc 10 §3.8). Read-only and **cache-free** — it reflects
 * live order/stock/activity state, so it opts out of any full-page cache and is
 * rendered per request (FR-43). All data comes from the bounded service reads in
 * `lib/services/admin-dashboard.ts` (no raw analytics scans).
 *
 * Layout is mobile-first (the founder runs this from a phone): quick actions as a
 * 2-up tap grid on top, KPI cards in a responsive grid, then the pending-orders
 * queue, low-stock alerts, recent activity, and a Phase-5 analytics placeholder.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  const firstName = admin.name.trim().split(/\s+/)[0] || "there";
  const isStaff = admin.role === "staff";

  // One round of bounded reads; the role decides which figures are computed.
  const [kpis, pendingOrders, lowStock, activity] = await Promise.all([
    getDashboardKpis(admin.role),
    getPendingOrders(6),
    getLowStockProducts(6),
    getRecentActivity(admin.role, 8),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`Welcome back, ${firstName}`}
        description="Here's what needs your attention today."
      />

      <QuickActions isStaff={isStaff} />

      {/* KPI cards — operational subset; revenue redacted for staff (FR-26). */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <KpiCard
          label="Orders today"
          value={String(kpis.ordersToday)}
          hint={`${kpis.orders7d} in last 7 days`}
          icon={<ShoppingBag className="size-4" />}
        />
        <KpiCard
          label="Orders (30 days)"
          value={String(kpis.orders30d)}
          hint="Rolling window"
          icon={<Activity className="size-4" />}
        />
        {kpis.revenueVisible ? (
          <KpiCard
            label="Revenue (requested)"
            value={formatPaise(kpis.revenueRequested7d ?? 0, { showDecimals: "never" })}
            hint="Last 7 days · requested, not collected"
            icon={<BarChart3 className="size-4" />}
          />
        ) : (
          <KpiCard
            label="Revenue"
            value="—"
            hint="Hidden for your role"
            icon={<BarChart3 className="size-4" />}
            muted
          />
        )}
        <KpiCard
          label="Needs action"
          value={String(kpis.pendingConfirmation)}
          hint={`${kpis.lowStock} low stock · ${kpis.newLeads} new leads`}
          icon={<ClipboardCheck className="size-4" />}
          tone={kpis.pendingConfirmation > 0 ? "warning" : undefined}
        />
      </section>

      {/* Operational panels: stack on mobile, two columns from lg. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PendingOrdersPanel orders={pendingOrders} />
        <LowStockPanel products={lowStock} />
      </div>

      <RecentActivityPanel items={activity} />

      {/* Visitor / conversion analytics land in Phase 5 (FR-43). */}
      <AnalyticsComingSoon />
    </div>
  );
}

// ───────────────────────────── quick actions ─────────────────────────────

/**
 * Always-visible primary actions (doc 10 FR-41), role-gated: `staff` only sees
 * "View new orders" + "Adjust inventory". A 2-up grid of large tap targets on
 * mobile that relaxes to a row on wider screens.
 */
function QuickActions({ isStaff }: { isStaff: boolean }) {
  const actions: Array<{
    label: string;
    href: string;
    icon: React.ReactNode;
    primary?: boolean;
    staff?: boolean; // visible to staff too
  }> = [
    {
      label: "View new orders",
      href: "/admin/orders?status=pending_confirmation",
      icon: <ShoppingBag className="size-5" />,
      primary: true,
      staff: true,
    },
    {
      label: "Adjust inventory",
      href: "/admin/inventory",
      icon: <Boxes className="size-5" />,
      staff: true,
    },
    {
      label: "Add product",
      href: "/admin/products/new",
      icon: <PackagePlus className="size-5" />,
    },
    {
      label: "New category",
      href: "/admin/categories",
      icon: <Inbox className="size-5" />,
    },
  ];

  const visible = actions.filter((a) => !isStaff || a.staff);

  return (
    <section
      aria-label="Quick actions"
      className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap"
    >
      {visible.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={cn(
            buttonVariants({ variant: a.primary ? "default" : "outline" }),
            "h-auto min-h-16 flex-col gap-1.5 rounded-2xl px-4 py-3 text-sm font-medium sm:h-auto sm:min-h-0 sm:flex-row sm:py-2.5",
          )}
        >
          {a.icon}
          {a.label}
        </Link>
      ))}
    </section>
  );
}

// ─────────────────────────────── KPI card ───────────────────────────────

function KpiCard({
  label,
  value,
  hint,
  icon,
  tone,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "warning";
  muted?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full",
            tone === "warning"
              ? "bg-accent/60 text-accent-foreground"
              : "bg-pastel-pink/30 text-primary",
          )}
          aria-hidden
        >
          {icon}
        </span>
      </div>
      <p
        className={cn(
          "mt-2 font-serif text-2xl font-bold tracking-tight",
          muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// ───────────────────────────── pending orders ─────────────────────────────

function PendingOrdersPanel({ orders }: { orders: PendingOrder[] }) {
  return (
    <Panel
      title={`Pending orders${orders.length ? ` (${orders.length})` : ""}`}
      description="Awaiting your confirmation"
      action={
        <Link
          href="/admin/orders?status=pending_confirmation"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View all <ArrowRight className="size-3.5" />
        </Link>
      }
      bodyClassName={orders.length ? "p-0 sm:p-0" : undefined}
    >
      {orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-6" />}
          title="You're all caught up"
          description="No orders are waiting for confirmation right now."
        />
      ) : (
        <ul className="divide-y divide-border">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/orders/${o.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {o.orderNumber}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.customerName} · {o.itemCount}{" "}
                    {o.itemCount === 1 ? "item" : "items"} · {timeAgoIST(o.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-foreground">
                    {formatPaise(o.grandTotal)}
                  </span>
                  <StatusBadge
                    tone={PAYMENT_STATUS[o.paymentStatus].tone}
                    label={PAYMENT_STATUS[o.paymentStatus].label}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ─────────────────────────────── low stock ───────────────────────────────

function LowStockPanel({ products }: { products: LowStockProduct[] }) {
  return (
    <Panel
      title={`Low stock${products.length ? ` (${products.length})` : ""}`}
      description="Restock or mark made-to-order"
      action={
        <Link
          href="/admin/inventory"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Inventory <ArrowRight className="size-3.5" />
        </Link>
      }
      bodyClassName={products.length ? "p-0 sm:p-0" : undefined}
    >
      {products.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-6" />}
          title="Stock looks healthy"
          description="No active products are low or out of stock."
        />
      ) : (
        <ul className="divide-y divide-border">
          {products.map((p) => (
            <li key={p.id}>
              <Link
                href="/admin/inventory"
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {p.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    SKU {p.sku} · {p.inventoryQuantity} in stock
                  </p>
                </div>
                <StatusBadge
                  tone={INVENTORY_STATE[p.state].tone}
                  label={INVENTORY_STATE[p.state].label}
                  className="shrink-0"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ───────────────────────────── recent activity ─────────────────────────────

function RecentActivityPanel({ items }: { items: ActivityItem[] }) {
  return (
    <Panel
      title="Recent activity"
      description="Latest changes across the store"
      action={
        <Link
          href="/admin/audit-log"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Audit log <ArrowRight className="size-3.5" />
        </Link>
      }
      bodyClassName={items.length ? "p-0 sm:p-0" : undefined}
    >
      {items.length === 0 ? (
        <EmptyState
          icon={<Activity className="size-6" />}
          title="No activity yet"
          description="Changes you and your team make will show up here."
        />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const body = (
              <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                <p className="min-w-0 text-sm text-foreground">{item.message}</p>
                <time
                  dateTime={item.createdAt.toISOString()}
                  title={formatDateTimeIST(item.createdAt)}
                  className="shrink-0 text-xs text-muted-foreground"
                >
                  {timeAgoIST(item.createdAt)}
                </time>
              </div>
            );
            return (
              <li key={item.key}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="block transition-colors hover:bg-muted/40"
                  >
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ─────────────────────────── analytics placeholder ───────────────────────────

function AnalyticsComingSoon() {
  return (
    <Panel title="Visitors & conversion" description="Traffic analytics">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Visitor counts, conversion rate, and average order value arrive in a
          later phase. Order and stock figures above are live now.
        </p>
        <StatusBadge tone="neutral" label="Coming soon" className="shrink-0" />
      </div>
    </Panel>
  );
}

// ─────────────────────────────── helpers ───────────────────────────────

/**
 * Compact "time since" label for the activity/queue rows (doc 10 FR-38). Server
 * -computed and stable per request (the page is `force-dynamic`); the absolute
 * IST timestamp is always available via the element's `title`/`dateTime`.
 */
function timeAgoIST(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  // Older than a week: fall back to an absolute IST date.
  return formatDateTimeIST(date);
}
