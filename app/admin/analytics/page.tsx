import type { Metadata } from "next";
import {
  Activity,
  BarChart3,
  Eye,
  LineChart,
  MousePointerClick,
  Smartphone,
  TrendingUp,
  Users,
} from "lucide-react";
import type { DeviceType } from "@prisma/client";

import { requireAdmin, hidesFinancials } from "@/lib/auth";
import { formatPaise } from "@/lib/money";
import { formatDateIST } from "@/lib/format";
import {
  getDeviceSplit,
  getFunnel,
  getRealtime,
  getTopPages,
  getTopProducts,
  getTopReferrers,
  getTrafficSummary,
  parseRange,
  serializeRealtime,
  type DaySeriesPoint,
  type RankedEntry,
} from "@/lib/services/analytics-report";

import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { EmptyState } from "@/components/admin/empty-state";
import {
  AdminTable,
  AdminTableHeader,
  AdminTableHead,
  AdminTableBody,
  AdminTableRow,
  AdminTableCell,
} from "@/components/admin/admin-table";

import { RangeSelect } from "@/components/admin/analytics/range-select";
import { TrafficChart } from "@/components/admin/analytics/traffic-chart";
import { FunnelChart } from "@/components/admin/analytics/funnel-chart";
import { DeviceDonut } from "@/components/admin/analytics/device-donut";
import { RealtimeWidget } from "@/components/admin/analytics/realtime-widget";

/**
 * Admin analytics overview (docs/13 §3.6, FR-22–FR-28). Replaces the dashboard's
 * "coming soon" placeholder. SSR + `force-dynamic` (the admin layout already
 * sets `robots: noindex`); reads pre-aggregated `DailyMetricRollup` rows for the
 * selected range plus a thin live "today" partial via the bounded service in
 * `lib/services/analytics-report.ts` — it never scans the raw firehose except the
 * `LIMIT`-bounded realtime window.
 *
 * Mobile-first (the founder runs this from a phone): KPI cards in a 2-up grid,
 * charts as responsive client islands, tables collapsing to cards. Financially
 * sensitive figures (revenue) are omitted for `staff` (docs/13 FR-27 / `10` FR-26).
 *
 * Analytics tables are near-empty in dev — every section renders a graceful
 * zero/empty state.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics",
};

const DEVICE_LABEL: Record<DeviceType, string> = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
  bot: "Bot",
};

const FUNNEL_STEP_LABEL: Record<string, string> = {
  page_view: "Page view",
  product_view: "Product view",
  add_to_cart: "Add to cart",
  begin_checkout: "Begin checkout",
  place_order: "Place order",
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const showRevenue = !hidesFinancials(admin.role);

  // One parallel fan-out of bounded reads (rollups + thin live partials). The
  // realtime seed is serialized with the same `serializeRealtime` the polling
  // Server Action uses, so the initial and refreshed shapes can never drift.
  const [traffic, funnel, deviceSplit, topProducts, topPages, topReferrers, realtime] =
    await Promise.all([
      getTrafficSummary(range),
      getFunnel(range),
      getDeviceSplit(range),
      getTopProducts(range),
      getTopPages(range),
      getTopReferrers(range),
      getRealtime(),
    ]);
  const realtimeInitial = serializeRealtime(realtime);

  const rangeLabel = `${formatDateIST(traffic.from, { day: "numeric", month: "short" })} – ${formatDateIST(
    traffic.to,
    { day: "numeric", month: "short" },
  )}`;

  // Pre-format the chart series client leaves consume (labels server-side, IST).
  const trafficData = traffic.series.map((p) => ({
    label: dayLabel(p),
    visitors: p.visitors,
    sessions: p.sessions,
    pageviews: p.pageviews,
  }));

  const funnelData = funnel.funnel.steps.map((s) => ({
    label: FUNNEL_STEP_LABEL[s.step] ?? s.step,
    count: s.count,
  }));

  const deviceData = deviceSplit.slices.map((s) => ({
    device: s.device,
    label: DEVICE_LABEL[s.device],
    count: s.count,
  }));

  const conversionPct = (traffic.totals.conversionRate * 100).toFixed(1);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Analytics"
        description={`Traffic & conversion · ${rangeLabel} (IST)`}
        action={<RangeSelect />}
      />

      <RealtimeWidget initial={realtimeInitial} />

      {/* KPI cards — operational; revenue omitted for staff. */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <KpiCard
          label="Visitors"
          value={formatCount(traffic.totals.visitors)}
          hint="Unique in range"
          icon={<Users className="size-4" />}
        />
        <KpiCard
          label="Sessions"
          value={formatCount(traffic.totals.sessions)}
          hint={`${formatCount(traffic.totals.pageviews)} pageviews`}
          icon={<Activity className="size-4" />}
        />
        <KpiCard
          label="Conversion"
          value={`${conversionPct}%`}
          hint="Orders / sessions"
          icon={<TrendingUp className="size-4" />}
        />
        {showRevenue ? (
          <KpiCard
            label="Revenue (requested)"
            value={formatPaise(traffic.totals.revenueRequested, { showDecimals: "never" })}
            hint={`${formatCount(traffic.totals.orders)} orders · requested, not collected`}
            icon={<BarChart3 className="size-4" />}
          />
        ) : (
          <KpiCard
            label="Orders"
            value={formatCount(traffic.totals.orders)}
            hint="Placed in range"
            icon={<BarChart3 className="size-4" />}
          />
        )}
      </section>

      {/* Traffic trend. */}
      <Panel
        title="Traffic over time"
        description="Visitors, sessions & pageviews by day"
      >
        {traffic.isEmpty ? (
          <EmptyState
            icon={<LineChart className="size-6" />}
            title="No traffic yet"
            description="Visitor activity will appear here once the storefront starts receiving traffic."
          />
        ) : (
          <TrafficChart data={trafficData} />
        )}
      </Panel>

      {/* Funnel + device split. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Conversion funnel"
          description="Page view → product view → cart → checkout → order"
        >
          {funnel.isEmpty ? (
            <EmptyState
              icon={<MousePointerClick className="size-6" />}
              title="No funnel data yet"
              description="The conversion funnel populates as visitors browse and check out."
            />
          ) : (
            <div className="space-y-4">
              <FunnelChart steps={funnelData} />
              <FunnelTable funnel={funnel.funnel} />
              <p className="text-xs text-muted-foreground">
                Event-volume based (not strict per-session sequence) in this view.
              </p>
            </div>
          )}
        </Panel>

        <Panel title="Device split" description="Sessions by device">
          {deviceSplit.total === 0 ? (
            <EmptyState
              icon={<Smartphone className="size-6" />}
              title="No sessions yet"
              description="Device breakdown appears once visitors arrive."
            />
          ) : (
            <DeviceDonut data={deviceData} />
          )}
        </Panel>
      </div>

      {/* Top tables. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <TopTable
          title="Top products"
          description="By product views"
          keyHeading="Product"
          icon={<Eye className="size-6" />}
          emptyTitle="No product views yet"
          rows={topProducts}
        />
        <TopTable
          title="Top pages"
          description="By page views"
          keyHeading="Page"
          icon={<Eye className="size-6" />}
          emptyTitle="No page views yet"
          rows={topPages}
        />
        <TopTable
          title="Top referrers"
          description="Acquisition sources"
          keyHeading="Source"
          icon={<Eye className="size-6" />}
          emptyTitle="No referrers yet"
          rows={topReferrers}
        />
      </div>
    </div>
  );
}

// ───────────────────────────── helpers ─────────────────────────────

/** Compact integer formatting (en-IN grouping). */
function formatCount(n: number): string {
  return n.toLocaleString("en-IN");
}

/** Short IST day label for the chart axis, marking today. */
function dayLabel(p: DaySeriesPoint): string {
  const base = formatDateIST(p.date, { day: "numeric", month: "short" });
  return p.live ? `${base} ·` : base;
}

/** Format a fraction (0..1) as a one-decimal percentage. */
function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

// ─────────────────────────────── KPI card ───────────────────────────────

function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-pastel-pink/30 text-primary"
          aria-hidden
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 font-serif text-2xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// ─────────────────────────────── funnel table ───────────────────────────────

function FunnelTable({
  funnel,
}: {
  funnel: Awaited<ReturnType<typeof getFunnel>>["funnel"];
}) {
  return (
    <AdminTable caption="Conversion funnel steps">
      <AdminTableHeader>
        <AdminTableHead>Step</AdminTableHead>
        <AdminTableHead className="text-right">Count</AdminTableHead>
        <AdminTableHead className="text-right">% of prev</AdminTableHead>
        <AdminTableHead className="text-right">% of top</AdminTableHead>
        <AdminTableHead className="text-right">Drop-off</AdminTableHead>
      </AdminTableHeader>
      <AdminTableBody>
        {funnel.steps.map((s) => (
          <AdminTableRow key={s.step}>
            <AdminTableCell label="Step">
              <span className="font-medium text-foreground">
                {FUNNEL_STEP_LABEL[s.step] ?? s.step}
              </span>
            </AdminTableCell>
            <AdminTableCell label="Count" className="text-right tabular-nums">
              {formatCount(s.count)}
            </AdminTableCell>
            <AdminTableCell label="% of prev" className="text-right tabular-nums">
              {pct(s.rateFromPrev)}
            </AdminTableCell>
            <AdminTableCell label="% of top" className="text-right tabular-nums">
              {pct(s.rateFromTop)}
            </AdminTableCell>
            <AdminTableCell label="Drop-off" className="text-right tabular-nums text-muted-foreground">
              {s.dropOff > 0 ? `-${formatCount(s.dropOff)}` : "—"}
            </AdminTableCell>
          </AdminTableRow>
        ))}
      </AdminTableBody>
    </AdminTable>
  );
}

// ─────────────────────────────── top table ───────────────────────────────

function TopTable({
  title,
  description,
  keyHeading,
  icon,
  emptyTitle,
  rows,
}: {
  title: string;
  description: string;
  keyHeading: string;
  icon: React.ReactNode;
  emptyTitle: string;
  rows: RankedEntry[];
}) {
  return (
    <Panel title={title} description={description} bodyClassName={rows.length ? "p-0 sm:p-0" : undefined}>
      {rows.length === 0 ? (
        <EmptyState icon={icon} title={emptyTitle} description="Data appears as visitors browse." />
      ) : (
        <AdminTable caption={title} className="px-4 py-2 sm:px-5">
          <AdminTableHeader>
            <AdminTableHead>{keyHeading}</AdminTableHead>
            <AdminTableHead className="text-right">Count</AdminTableHead>
          </AdminTableHeader>
          <AdminTableBody>
            {rows.map((r) => (
              <AdminTableRow key={r.key}>
                <AdminTableCell label={keyHeading}>
                  <span className="block min-w-0 truncate text-foreground" title={r.label}>
                    {r.label}
                  </span>
                </AdminTableCell>
                <AdminTableCell label="Count" className="text-right tabular-nums">
                  {formatCount(r.count)}
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminTable>
      )}
    </Panel>
  );
}
