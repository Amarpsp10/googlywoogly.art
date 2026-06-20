import "server-only";

import { Prisma, type AnalyticsEventType, type DeviceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  computeFunnel,
  type Funnel,
  type FunnelRollupInput,
} from "@/lib/analytics/events";
import { getDailyRollups, type DailyRollup } from "@/lib/services/analytics";

/**
 * Read services for the **admin analytics dashboards** (docs/13 §3.6, FR-22–FR-28).
 *
 * Performance posture (docs/13 §9, FR-22; CANON §12): dashboards read the
 * pre-aggregated `DailyMetricRollup` rows for the selected range and stitch a
 * **thin live "today" partial** on top (today has no rollup yet). The only
 * request-time raw-`AnalyticsEvent` reads are bounded + indexed: the live
 * "today" aggregates (capped to a single IST day) and the realtime window
 * (30 min + `LIMIT`). We never scan the raw firehose across the whole range.
 *
 * Privacy (docs/13 FR-30, AC-2): every shape returned here is **non-identifying**
 * — visitor/session counts, event counts, paths, referrer hosts, product ids,
 * device buckets, paise. No name/email/phone/IP ever appears.
 *
 * Money stays in integer **paise** (CANON §10); `formatPaise` happens in the view.
 */

// ───────────────────────────── range ─────────────────────────────

/** Supported dashboard ranges (docs/13 FR-23; this view ships 7d/30d). */
export type AnalyticsRange = "7d" | "30d";

export const DEFAULT_RANGE: AnalyticsRange = "7d";

/** Number of IST calendar days each range spans (inclusive of today). */
const RANGE_DAYS: Record<AnalyticsRange, number> = {
  "7d": 7,
  "30d": 30,
};

/**
 * Parse the `?range` query param to a known range, defaulting to 7d. Unknown /
 * absent values fall back to the default rather than erroring (lenient UI).
 */
export function parseRange(value: string | string[] | undefined): AnalyticsRange {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "30d" || v === "7d" ? v : DEFAULT_RANGE;
}

/** IST is a fixed UTC+05:30 offset (no DST) — mirrors `admin-dashboard.ts`. */
const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;
const DAY_MS = 86_400_000;

/** Start of today in IST, expressed as a UTC instant. */
function startOfTodayIST(now: Date): Date {
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const istMidnight = Date.UTC(
    istNow.getUTCFullYear(),
    istNow.getUTCMonth(),
    istNow.getUTCDate(),
  );
  return new Date(istMidnight - IST_OFFSET_MS);
}

/** The `@db.Date` key (UTC midnight) for the IST day that `instant` falls in. */
function rollupDateKey(istDayStart: Date): Date {
  const ist = new Date(istDayStart.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

/** Resolved IST-day bounds for a range. */
export interface ResolvedRange {
  range: AnalyticsRange;
  /** Inclusive start of the first IST day (UTC instant). */
  fromInstant: Date;
  /** Start of today in IST (UTC instant) — the live-partial boundary. */
  todayStartInstant: Date;
  /** `@db.Date` key for the first day (rollup lower bound). */
  fromDateKey: Date;
  /** `@db.Date` key for yesterday (rollup upper bound; today is live). */
  yesterdayDateKey: Date;
  /** `@db.Date` key for today (used to dedupe a stray same-day rollup). */
  todayDateKey: Date;
  /** Number of IST days in the window (inclusive of today). */
  days: number;
}

/**
 * Resolve a range to IST-day bounds. The rollup window is `[from, yesterday]`;
 * `today` is always served from the live partial so the latest day is fresh.
 */
export function resolveRange(range: AnalyticsRange, now: Date = new Date()): ResolvedRange {
  const days = RANGE_DAYS[range];
  const todayStartInstant = startOfTodayIST(now);
  const fromInstant = new Date(todayStartInstant.getTime() - (days - 1) * DAY_MS);
  const todayDateKey = rollupDateKey(todayStartInstant);
  return {
    range,
    fromInstant,
    todayStartInstant,
    fromDateKey: rollupDateKey(fromInstant),
    yesterdayDateKey: new Date(todayDateKey.getTime() - DAY_MS),
    todayDateKey,
    days,
  };
}

// ───────────────────────── shared list shape ─────────────────────────

/** A ranked, non-identifying entry for the top-N tables (docs/13 FR-18 JSON shape). */
export interface RankedEntry {
  /** Stable key (productId / referrer host / path). */
  key: string;
  /** Display label (product title / host / path). */
  label: string;
  /** Absolute count over the range. */
  count: number;
  /** Optional value in paise (top products may carry add-to-cart value). */
  valuePaise?: number;
}

/** Tolerant parse of a rollup `topX` JSON column into `RankedEntry[]`. */
function parseRanked(json: Prisma.JsonValue | null | undefined): RankedEntry[] {
  if (!Array.isArray(json)) return [];
  const out: RankedEntry[] = [];
  for (const row of json) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const key = typeof r.key === "string" ? r.key : undefined;
    const count = typeof r.count === "number" ? r.count : undefined;
    if (key === undefined || count === undefined) continue;
    const label = typeof r.label === "string" && r.label ? r.label : key;
    const valuePaise = typeof r.valuePaise === "number" ? r.valuePaise : undefined;
    out.push({ key, label, count, ...(valuePaise !== undefined ? { valuePaise } : {}) });
  }
  return out;
}

/** Merge ranked lists (summing counts/values by key) and return the top `limit`. */
function mergeRanked(lists: RankedEntry[][], limit: number): RankedEntry[] {
  const byKey = new Map<string, RankedEntry>();
  for (const list of lists) {
    for (const entry of list) {
      const existing = byKey.get(entry.key);
      if (existing) {
        existing.count += entry.count;
        if (entry.valuePaise !== undefined) {
          existing.valuePaise = (existing.valuePaise ?? 0) + entry.valuePaise;
        }
        // Prefer a non-key label if we now have one.
        if (existing.label === existing.key && entry.label !== entry.key) {
          existing.label = entry.label;
        }
      } else {
        byKey.set(entry.key, { ...entry });
      }
    }
  }
  return [...byKey.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

// ───────────────────────── rollups + live today ─────────────────────────

/** A single day's funnel + headline counts, used for the by-day series. */
export interface DaySeriesPoint {
  /** `@db.Date` key (UTC midnight of the IST day). */
  date: Date;
  visitors: number;
  sessions: number;
  pageviews: number;
  productViews: number;
  addToCarts: number;
  beginCheckouts: number;
  orders: number;
  revenueRequested: number;
  /** True for the live, not-yet-rolled-up day (today). */
  live: boolean;
}

/** Zeroed series point for a given date (graceful empty days). */
function emptyPoint(date: Date, live: boolean): DaySeriesPoint {
  return {
    date,
    visitors: 0,
    sessions: 0,
    pageviews: 0,
    productViews: 0,
    addToCarts: 0,
    beginCheckouts: 0,
    orders: 0,
    revenueRequested: 0,
    live,
  };
}

/** Map a rollup row to a series point. */
function pointFromRollup(r: DailyRollup): DaySeriesPoint {
  return {
    date: r.date,
    visitors: r.visitors,
    sessions: r.sessions,
    pageviews: r.pageviews,
    productViews: r.productViews,
    addToCarts: r.addToCarts,
    beginCheckouts: r.beginCheckouts,
    orders: r.orders,
    revenueRequested: r.revenueRequested,
    live: false,
  };
}

/**
 * Live "today" partial (docs/13 FR-22): a bounded, indexed read of the raw event
 * firehose for the single IST day in progress. `groupBy(type)` over
 * `createdAt >= todayStart` rides the `(type, createdAt)` / `createdAt` indexes
 * and touches only today's slice — never the whole range.
 */
async function getLiveToday(rr: ResolvedRange): Promise<DaySeriesPoint> {
  const where = { createdAt: { gte: rr.todayStartInstant } } as const;

  const [byType, revenueAgg, sessions, visitors] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["type"],
      where,
      _count: { _all: true },
    }),
    prisma.analyticsEvent.aggregate({
      where: { ...where, type: "place_order" },
      _sum: { value: true },
    }),
    prisma.analyticsSession.count({
      where: { startedAt: { gte: rr.todayStartInstant } },
    }),
    distinctVisitorsSince(rr.todayStartInstant),
  ]);

  const counts: Record<string, number> = {};
  for (const row of byType) counts[row.type] = row._count._all;

  const point = emptyPoint(rr.todayDateKey, true);
  point.pageviews = counts.page_view ?? 0;
  point.productViews = counts.product_view ?? 0;
  point.addToCarts = counts.add_to_cart ?? 0;
  point.beginCheckouts = counts.begin_checkout ?? 0;
  point.orders = counts.place_order ?? 0;
  point.revenueRequested = revenueAgg._sum.value ?? 0;
  point.sessions = sessions;
  point.visitors = visitors;
  return point;
}

/** `COUNT(DISTINCT visitorId)` of events since `since` (bounded by the index). */
async function distinctVisitorsSince(since: Date): Promise<number> {
  const rows = await prisma.analyticsEvent.findMany({
    where: { createdAt: { gte: since } },
    distinct: ["visitorId"],
    select: { visitorId: true },
  });
  return rows.length;
}

/**
 * The full by-day series for a range: a rollup row per past IST day plus the
 * live "today" partial, gap-filled with zeroed days so charts/tables never see a
 * hole (docs/13 §7 — graceful zero state). Returned ascending by date.
 */
async function getSeries(rr: ResolvedRange): Promise<DaySeriesPoint[]> {
  const [rollups, today] = await Promise.all([
    getDailyRollups(rr.fromDateKey, rr.yesterdayDateKey),
    getLiveToday(rr),
  ]);

  const byKey = new Map<number, DaySeriesPoint>();
  for (const r of rollups) byKey.set(r.date.getTime(), pointFromRollup(r));
  // Today is authoritative from the live partial (ignore any stray same-day rollup).
  byKey.set(today.date.getTime(), today);

  const series: DaySeriesPoint[] = [];
  for (let i = 0; i < rr.days; i++) {
    const key = new Date(rr.fromDateKey.getTime() + i * DAY_MS);
    const isToday = key.getTime() === rr.todayDateKey.getTime();
    series.push(byKey.get(key.getTime()) ?? emptyPoint(key, isToday));
  }
  return series;
}

/** Sum a numeric field across the series. */
function sumSeries(series: DaySeriesPoint[], field: keyof DaySeriesPoint): number {
  let total = 0;
  for (const p of series) {
    const v = p[field];
    if (typeof v === "number") total += v;
  }
  return total;
}

// ───────────────────────────── traffic summary ─────────────────────────────

/** KPI + series payload for the Traffic dashboard (docs/13 FR-24). */
export interface TrafficSummary {
  range: AnalyticsRange;
  /** Inclusive IST-day bounds (UTC instants) for labelling. */
  from: Date;
  to: Date;
  totals: {
    visitors: number;
    sessions: number;
    pageviews: number;
    orders: number;
    revenueRequested: number;
    /** Pages per session (pageviews / sessions), 0 when no sessions. */
    pagesPerSession: number;
    /** Conversion: orders / sessions, as a fraction in [0,1]. */
    conversionRate: number;
  };
  /** Per-IST-day series (ascending), gap-filled with zero days. */
  series: DaySeriesPoint[];
  /** True when the window has no recorded activity at all (empty state). */
  isEmpty: boolean;
}

/** Safe ratio in [0, ∞); 0 when the denominator is non-positive. */
function safeRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Traffic KPIs + the by-day series for the selected range (docs/13 FR-24).
 * Reads `DailyMetricRollup` for past days and a live partial for today.
 */
export async function getTrafficSummary(range: AnalyticsRange): Promise<TrafficSummary> {
  const rr = resolveRange(range);
  const series = await getSeries(rr);

  const visitors = sumSeries(series, "visitors");
  const sessions = sumSeries(series, "sessions");
  const pageviews = sumSeries(series, "pageviews");
  const orders = sumSeries(series, "orders");
  const revenueRequested = sumSeries(series, "revenueRequested");

  return {
    range,
    from: rr.fromInstant,
    to: rr.todayStartInstant,
    totals: {
      visitors,
      sessions,
      pageviews,
      orders,
      revenueRequested,
      pagesPerSession: safeRatio(pageviews, sessions),
      conversionRate: safeRatio(orders, sessions),
    },
    series,
    isEmpty: visitors === 0 && sessions === 0 && pageviews === 0 && orders === 0,
  };
}

// ───────────────────────────── funnel ─────────────────────────────

/** Funnel payload for the dashboard (docs/13 FR-26). */
export interface FunnelReport {
  range: AnalyticsRange;
  funnel: Funnel;
  /** True when there are no page views in the window (empty state). */
  isEmpty: boolean;
}

/**
 * The 5-step conversion funnel for the range (docs/13 FR-26). Built from the
 * by-day series (rollup columns + live today) and the pure `computeFunnel`.
 */
export async function getFunnel(range: AnalyticsRange): Promise<FunnelReport> {
  const rr = resolveRange(range);
  const series = await getSeries(rr);
  const rollupInputs: FunnelRollupInput[] = series.map((p) => ({
    pageviews: p.pageviews,
    productViews: p.productViews,
    addToCarts: p.addToCarts,
    beginCheckouts: p.beginCheckouts,
    orders: p.orders,
  }));
  const funnel = computeFunnel(rollupInputs);
  return { range, funnel, isEmpty: funnel.pageViews === 0 };
}

// ───────────────────────────── top tables ─────────────────────────────

/** Default top-N size for the dashboard tables. */
const TOP_N = 10;

/**
 * Read the persisted `topX` JSON from the past-day rollups for a range. The live
 * "today" slice is folded in by the per-report helpers via a bounded `groupBy`.
 */
async function getRollupTops(
  rr: ResolvedRange,
): Promise<Pick<DailyRollup, "topProducts" | "topReferrers" | "topPages">[]> {
  return prisma.dailyMetricRollup.findMany({
    where: { date: { gte: rr.fromDateKey, lte: rr.yesterdayDateKey } },
    select: { topProducts: true, topReferrers: true, topPages: true },
  });
}

/**
 * Top products over the range (docs/13 FR-18/FR-25): merges the persisted
 * `topProducts` rollup lists with a bounded live `product_view` `groupBy` for
 * today. Labels fall back to the productId when the rollup didn't carry a title.
 */
export async function getTopProducts(
  range: AnalyticsRange,
  limit = TOP_N,
): Promise<RankedEntry[]> {
  const rr = resolveRange(range);
  const [rollups, liveRows] = await Promise.all([
    getRollupTops(rr),
    prisma.analyticsEvent.groupBy({
      by: ["productId"],
      where: {
        type: "product_view",
        productId: { not: null },
        createdAt: { gte: rr.todayStartInstant },
      },
      _count: { _all: true },
      orderBy: { _count: { productId: "desc" } },
      take: 50,
    }),
  ]);

  const fromRollups = rollups.map((r) => parseRanked(r.topProducts));
  const live: RankedEntry[] = liveRows
    .filter((row): row is typeof row & { productId: string } => row.productId !== null)
    .map((row) => ({ key: row.productId, label: row.productId, count: row._count._all }));

  const merged = mergeRanked([...fromRollups, live], limit);
  return hydrateProductLabels(merged);
}

/**
 * Replace key-only labels with live product titles (a tiny bounded lookup over
 * the merged top-N ids). Non-identifying — titles are catalog data, not PII.
 */
async function hydrateProductLabels(entries: RankedEntry[]): Promise<RankedEntry[]> {
  const needTitle = entries.filter((e) => e.label === e.key).map((e) => e.key);
  if (needTitle.length === 0) return entries;
  const products = await prisma.product.findMany({
    where: { id: { in: needTitle } },
    select: { id: true, title: true },
  });
  const titleById = new Map(products.map((p) => [p.id, p.title]));
  return entries.map((e) =>
    e.label === e.key ? { ...e, label: titleById.get(e.key) ?? e.key } : e,
  );
}

/**
 * Top referrer hosts over the range (docs/13 FR-18/FR-24). Merges persisted
 * `topReferrers` with a bounded live aggregation for today (host extracted from
 * `AnalyticsSession.referrer`, which is the first-touch acquisition source).
 */
export async function getTopReferrers(
  range: AnalyticsRange,
  limit = TOP_N,
): Promise<RankedEntry[]> {
  const rr = resolveRange(range);
  const [rollups, liveSessions] = await Promise.all([
    getRollupTops(rr),
    prisma.analyticsSession.findMany({
      where: { startedAt: { gte: rr.todayStartInstant }, referrer: { not: null } },
      select: { referrer: true },
      take: 500,
    }),
  ]);

  const fromRollups = rollups.map((r) => parseRanked(r.topReferrers));

  const liveByHost = new Map<string, number>();
  for (const s of liveSessions) {
    const host = referrerHost(s.referrer);
    if (!host) continue;
    liveByHost.set(host, (liveByHost.get(host) ?? 0) + 1);
  }
  const live: RankedEntry[] = [...liveByHost.entries()].map(([host, count]) => ({
    key: host,
    label: host,
    count,
  }));

  return mergeRanked([...fromRollups, live], limit);
}

/** Extract a bare host from a referrer URL/string; null when not parseable. */
function referrerHost(referrer: string | null): string | null {
  if (!referrer) return null;
  const raw = referrer.trim();
  if (raw.length === 0) return null;
  try {
    return new URL(raw).host || null;
  } catch {
    // Bare host or "host/path" — take the first path segment's host part.
    const host = raw.replace(/^https?:\/\//i, "").split("/")[0]?.trim();
    return host && host.length > 0 ? host : null;
  }
}

/**
 * Top pages by `page_view` over the range (docs/13 FR-18/FR-25). Merges persisted
 * `topPages` with a bounded live `page_view` `groupBy(path)` for today.
 */
export async function getTopPages(
  range: AnalyticsRange,
  limit = TOP_N,
): Promise<RankedEntry[]> {
  const rr = resolveRange(range);
  const [rollups, liveRows] = await Promise.all([
    getRollupTops(rr),
    prisma.analyticsEvent.groupBy({
      by: ["path"],
      where: { type: "page_view", createdAt: { gte: rr.todayStartInstant } },
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
      take: 50,
    }),
  ]);

  const fromRollups = rollups.map((r) => parseRanked(r.topPages));
  const live: RankedEntry[] = liveRows.map((row) => ({
    key: row.path,
    label: row.path,
    count: row._count._all,
  }));

  return mergeRanked([...fromRollups, live], limit);
}

// ───────────────────────────── device split ─────────────────────────────

/** One device bucket's share of sessions (docs/13 FR-24 donut). */
export interface DeviceSlice {
  device: DeviceType;
  count: number;
  /** Share of the total, as a fraction in [0,1]. */
  share: number;
}

/** Device split payload. */
export interface DeviceSplit {
  range: AnalyticsRange;
  slices: DeviceSlice[];
  total: number;
}

/**
 * Session device split over the range (docs/13 FR-24). Aggregates
 * `AnalyticsSession.device` by `startedAt` window (indexed). Bot traffic is
 * already dropped at ingest, so buckets are real visitors. `null` device rows
 * are folded into `desktop` (the conservative default) so shares always sum.
 */
export async function getDeviceSplit(range: AnalyticsRange): Promise<DeviceSplit> {
  const rr = resolveRange(range);
  const rows = await prisma.analyticsSession.groupBy({
    by: ["device"],
    where: { startedAt: { gte: rr.fromInstant } },
    _count: { _all: true },
  });

  const counts = new Map<DeviceType, number>();
  let total = 0;
  for (const row of rows) {
    const device = (row.device ?? "desktop") as DeviceType;
    const n = row._count._all;
    counts.set(device, (counts.get(device) ?? 0) + n);
    total += n;
  }

  const order: DeviceType[] = ["mobile", "tablet", "desktop", "bot"];
  const slices: DeviceSlice[] = order
    .filter((d) => (counts.get(d) ?? 0) > 0)
    .map((device) => {
      const count = counts.get(device) ?? 0;
      return { device, count, share: safeRatio(count, total) };
    });

  return { range, slices, total };
}

// ───────────────────────────── realtime ─────────────────────────────

/** Realtime window length (docs/13 FR-28 — the only request-time firehose read). */
export const REALTIME_WINDOW_MS = 30 * 60_000;

/** Number of recent events surfaced in the live feed (bounded). */
const REALTIME_FEED_LIMIT = 20;

/** A single non-identifying live-feed event (type + path + when). */
export interface RealtimeEvent {
  id: string;
  type: AnalyticsEventType;
  path: string;
  createdAt: Date;
}

/** Realtime "Right now" payload (docs/13 FR-28). */
export interface Realtime {
  /** Window length in minutes (for the label). */
  windowMinutes: number;
  /** Distinct visitors active in the window. */
  activeVisitors: number;
  /** Distinct sessions active in the window. */
  activeSessions: number;
  /** Most recent events (newest first), capped. */
  recentEvents: RealtimeEvent[];
  /** Top active pages in the window. */
  topActivePages: RankedEntry[];
}

/**
 * Realtime widget data (docs/13 FR-28): active visitors/sessions, a capped live
 * event feed, and top active pages — all from one bounded `createdAt` window
 * (last 30 min). This is the only request-time read of the raw firehose and is
 * `LIMIT`/window-bounded so it stays cheap and free-tier-safe.
 */
export async function getRealtime(now: Date = new Date()): Promise<Realtime> {
  const since = new Date(now.getTime() - REALTIME_WINDOW_MS);
  const where = { createdAt: { gte: since } } as const;

  const [recent, visitorRows, sessionRows, pageRows] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: REALTIME_FEED_LIMIT,
      select: { id: true, type: true, path: true, createdAt: true },
    }),
    prisma.analyticsEvent.findMany({
      where,
      distinct: ["visitorId"],
      select: { visitorId: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { ...where, sessionId: { not: null } },
      distinct: ["sessionId"],
      select: { sessionId: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["path"],
      where: { ...where, type: "page_view" },
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
      take: 5,
    }),
  ]);

  return {
    windowMinutes: Math.round(REALTIME_WINDOW_MS / 60_000),
    activeVisitors: visitorRows.length,
    activeSessions: sessionRows.length,
    recentEvents: recent,
    topActivePages: pageRows.map((row) => ({
      key: row.path,
      label: row.path,
      count: row._count._all,
    })),
  };
}

/** A live-feed event with `createdAt` as epoch ms (client-serializable). */
export interface RealtimeFeedItem {
  id: string;
  type: AnalyticsEventType;
  path: string;
  /** Epoch milliseconds (UTC). */
  at: number;
}

/**
 * Fully serializable realtime snapshot, safe to cross the RSC → client boundary
 * (no `Date` instances). Both the page seed and the polling Server Action return
 * this exact shape via {@link serializeRealtime}, so they can never drift.
 */
export interface RealtimeSnapshot {
  windowMinutes: number;
  activeVisitors: number;
  activeSessions: number;
  recentEvents: RealtimeFeedItem[];
  topActivePages: { key: string; label: string; count: number }[];
  /** When this snapshot was produced (epoch ms), for the "updated" label. */
  generatedAt: number;
}

/** Map a {@link Realtime} read to the serializable {@link RealtimeSnapshot}. */
export function serializeRealtime(rt: Realtime): RealtimeSnapshot {
  return {
    windowMinutes: rt.windowMinutes,
    activeVisitors: rt.activeVisitors,
    activeSessions: rt.activeSessions,
    recentEvents: rt.recentEvents.map((e) => ({
      id: e.id,
      type: e.type,
      path: e.path,
      at: e.createdAt.getTime(),
    })),
    topActivePages: rt.topActivePages.map((p) => ({
      key: p.key,
      label: p.label,
      count: p.count,
    })),
    generatedAt: Date.now(),
  };
}
