import "server-only";

import { AnalyticsEventType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Nightly `DailyMetricRollup` aggregation (docs/13 §3.5, FR-18..FR-20, AC-6).
 *
 * The cron (`/api/cron/rollup`) calls {@link rollupDay} for the previous IST
 * calendar day (and today, for a partial). Each call aggregates that day's
 * `AnalyticsEvent` + `AnalyticsSession` + `Order` into **one** `DailyMetricRollup`
 * row and **upserts** it by the `date` PK, so re-runs are idempotent (FR-18,
 * edge: "Rollup re-run"). Dashboards then read these small rows instead of
 * scanning the raw event firehose (CANON §12; docs/13 §2 invariant 4).
 *
 * Privacy (docs/13 FR-30): the rollup is a **non-PII aggregate**. The only
 * identifier touched is the pseudonymous `visitorId` (for a distinct count); no
 * name/email/phone/address/IP is read or written. `DailyMetricRollup` is the one
 * analytics table retained indefinitely (FR-21/FR-34) precisely because it holds
 * no personal data.
 *
 * Time is the subtle part: a rollup row is keyed by an **IST calendar day**, but
 * `createdAt`/`startedAt` are stored UTC `Timestamptz`. We compute the
 * half-open UTC instant window `[dayStartUtc, nextDayStartUtc)` for that IST day
 * and the `@db.Date` PK value with {@link istDayBounds} (pure, unit-tested).
 *
 * The pure aggregation helpers (`conversionRateBps`, `topNFromCounts`,
 * `istDayBounds`) are exported so they can be unit-tested without a DB (the DB
 * aggregation itself has no test DB — see the test file header).
 */

// ───────────────────────────── pure: IST day math ─────────────────────────────

/**
 * IST is a fixed UTC+05:30 offset (no DST) — matches `lib/services/admin-dashboard.ts`
 * so every "IST calendar day" boundary in the app agrees (CANON §10).
 */
export const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

const MS_PER_DAY = 86_400_000;

/** The UTC instant window + `@db.Date` PK for the IST day that contains `instant`. */
export interface IstDayBounds {
  /**
   * The `DailyMetricRollup.date` PK value. Prisma maps `@db.Date` to a JS `Date`
   * at **UTC midnight** of the calendar date, so we store UTC-midnight of the IST
   * calendar date — this is what `getDailyRollups` compares against (docs/13 §6).
   */
  date: Date;
  /** Inclusive lower bound: the UTC instant of IST-midnight for that day. */
  startUtc: Date;
  /** Exclusive upper bound: the UTC instant of the next IST-midnight (`< end`). */
  endUtc: Date;
  /** `YYYY-MM-DD` label of the IST calendar day (handy for logs/responses). */
  iso: string;
}

/**
 * Resolve the IST calendar day containing a UTC `instant` to its query window and
 * PK. Pure & total. Shift the clock into IST, zero the time-of-day, then shift
 * back to UTC for the event-window bounds; the PK is the same Y/M/D at UTC
 * midnight (the canonical `@db.Date` representation).
 */
export function istDayBounds(instant: Date): IstDayBounds {
  const ist = new Date(instant.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth();
  const day = ist.getUTCDate();

  // UTC-midnight of the IST calendar date → the `@db.Date` PK value.
  const dateUtcMidnightMs = Date.UTC(year, month, day);
  // The same wall-clock midnight *in IST*, expressed as a UTC instant.
  const startUtcMs = dateUtcMidnightMs - IST_OFFSET_MS;

  return {
    date: new Date(dateUtcMidnightMs),
    startUtc: new Date(startUtcMs),
    endUtc: new Date(startUtcMs + MS_PER_DAY),
    iso: `${year.toString().padStart(4, "0")}-${(month + 1)
      .toString()
      .padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
  };
}

// ─────────────────────────── pure: conversion rate ───────────────────────────

/**
 * Conversion rate in **integer basis points** (docs/13 FR-18, AC-6;
 * `03` FR + AC — no float stored): `round(orders / sessions × 10000)`.
 * Mirrors SQL `NULLIF(sessions,0)`: 0 sessions ⇒ 0 bps (no divide-by-zero, the
 * dashboard renders "—" — docs/13 edge "sessions = 0 for conversionRate").
 */
export function conversionRateBps(orders: number, sessions: number): number {
  if (sessions <= 0) return 0;
  return Math.round((orders / sessions) * 10_000);
}

// ───────────────────────────── pure: top-N reducer ─────────────────────────────

/** Size of the persisted top-N lists (docs/13 FR-18, N=20). */
export const TOP_N = 20;

/** A ranked entry in `topProducts` / `topReferrers` / `topPages` (docs/13 FR-18). */
export interface TopEntry {
  /** Stable identity: `productId` | referrer host | path. */
  key: string;
  /** Human label (product title, host, or path; falls back to `key`). */
  label: string;
  /** Primary rank metric (e.g. `product_view` / `page_view` count). */
  count: number;
  /** Optional monetary aggregate in paise (omitted when not applicable). */
  valuePaise?: number;
}

/** Mutable accumulator used while folding events into a top-N bucket. */
export interface TopAccumulator {
  key: string;
  label: string;
  count: number;
  /** Secondary sort key (e.g. add-to-cart count) — tiebreak only, not persisted. */
  tiebreak: number;
  /** Running paise total; surfaced as `valuePaise` only when > 0. */
  valuePaise: number;
}

/**
 * Rank a map of accumulators into the persisted top-N list (pure, deterministic).
 * Sort by `count` desc, then `tiebreak` desc (docs/13: "+ add-to-cart as
 * tiebreak"), then `key` asc as a stable final tiebreaker so re-runs produce an
 * identical row (idempotency, FR-18). `valuePaise` is emitted only when nonzero.
 */
export function topNFromCounts(
  counts: ReadonlyMap<string, TopAccumulator>,
  n: number = TOP_N,
): TopEntry[] {
  return Array.from(counts.values())
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.tiebreak - a.tiebreak ||
        (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    )
    .slice(0, Math.max(0, n))
    .map((a) => {
      const entry: TopEntry = { key: a.key, label: a.label, count: a.count };
      if (a.valuePaise > 0) entry.valuePaise = a.valuePaise;
      return entry;
    });
}

/**
 * Extract the host from a referrer string for `topReferrers` grouping
 * (docs/13 FR-18 "referrer hosts"). Returns null for empty/internal/unparseable
 * referrers so they don't pollute the report. Pure.
 */
export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  const raw = referrer.trim();
  if (raw.length === 0) return null;
  try {
    // Tolerate origin+path, bare host, or protocol-relative forms.
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase();
    return host.length > 0 ? host : null;
  } catch {
    return null;
  }
}

// ───────────────────────────── DB aggregation ─────────────────────────────

/** The numbers a single {@link rollupDay} call computed (also the cron's JSON). */
export interface RollupSummary {
  /** `YYYY-MM-DD` of the rolled-up IST day. */
  date: string;
  visitors: number;
  sessions: number;
  pageviews: number;
  productViews: number;
  addToCarts: number;
  beginCheckouts: number;
  orders: number;
  /** Paise (Σ `place_order.value` = Σ `Order.grandTotal` placed that day). */
  revenueRequested: number;
  /** Integer basis points. */
  conversionRate: number;
}

/** Event types whose per-day counts become rollup funnel columns (docs/13 FR-19). */
const FUNNEL_COUNT_TYPES = [
  AnalyticsEventType.page_view,
  AnalyticsEventType.product_view,
  AnalyticsEventType.add_to_cart,
  AnalyticsEventType.begin_checkout,
  AnalyticsEventType.place_order,
] as const;

/** Minimal event projection we scan for a day (no PII — only these columns). */
type RollupEventRow = {
  visitorId: string;
  type: AnalyticsEventType;
  path: string;
  referrer: string | null;
  productId: string | null;
  value: number | null;
};

/** Serialize a top-N list to a JSON column value (`JsonNull` when empty). */
function topListToJson(list: TopEntry[]): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return list.length > 0 ? (list as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
}

/**
 * Aggregate one **IST calendar day** and upsert its `DailyMetricRollup` row
 * (docs/13 FR-18, AC-6). `date` may be any instant within the target day — the
 * IST day that contains it is resolved via {@link istDayBounds}. Idempotent:
 * keyed by the `date` PK, a re-run overwrites (never double-counts).
 *
 * Reads are bounded by indexed columns: events by `createdAt`
 * (`@@index([createdAt])` / `([type, createdAt])`) and sessions by `startedAt`
 * (`@@index([startedAt])`) over the `[startUtc, endUtc)` window — the nightly
 * job is the only heavy aggregation and runs off-peak (docs/13 §10).
 */
export async function rollupDay(date: Date): Promise<RollupSummary> {
  const { date: pk, startUtc, endUtc, iso } = istDayBounds(date);
  const window = { gte: startUtc, lt: endUtc };

  // Pull only the non-PII columns we need for the day's events. Volume is small
  // for a single-founder store (docs/13 §10); a single scan keeps the counts,
  // distinct-visitor set, and top-N folds consistent from one snapshot.
  const [events, sessions] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: { createdAt: window },
      select: {
        visitorId: true,
        type: true,
        path: true,
        referrer: true,
        productId: true,
        value: true,
      },
    }) as Promise<RollupEventRow[]>,
    // sessions = COUNT(*) of AnalyticsSession with startedAt in the day (FR-18).
    prisma.analyticsSession.count({ where: { startedAt: window } }),
  ]);

  // Funnel counts + distinct visitors + top-N folds in one pass.
  const counts: Record<(typeof FUNNEL_COUNT_TYPES)[number], number> = {
    [AnalyticsEventType.page_view]: 0,
    [AnalyticsEventType.product_view]: 0,
    [AnalyticsEventType.add_to_cart]: 0,
    [AnalyticsEventType.begin_checkout]: 0,
    [AnalyticsEventType.place_order]: 0,
  };
  const visitors = new Set<string>();
  let revenueRequested = 0;

  const productAcc = new Map<string, TopAccumulator>();
  const referrerAcc = new Map<string, TopAccumulator>();
  const pageAcc = new Map<string, TopAccumulator>();

  for (const ev of events) {
    if (ev.visitorId) visitors.add(ev.visitorId);

    if (ev.type in counts) {
      counts[ev.type as (typeof FUNNEL_COUNT_TYPES)[number]] += 1;
    }

    if (ev.type === AnalyticsEventType.place_order) {
      // Server-trusted revenue (docs/13 FR-17); value is integer paise.
      revenueRequested += ev.value ?? 0;
    }

    // topPages: by page_view (FR-18).
    if (ev.type === AnalyticsEventType.page_view) {
      bump(pageAcc, ev.path, ev.path, 0, 0);

      // topReferrers: referrer hosts of page_views (FR-18).
      const host = referrerHost(ev.referrer);
      if (host) bump(referrerAcc, host, host, 0, 0);
    }

    // topProducts: rank by product_view, tiebreak by add_to_cart (FR-18).
    if (ev.productId) {
      if (ev.type === AnalyticsEventType.product_view) {
        bump(productAcc, ev.productId, ev.productId, 0, 0);
      } else if (ev.type === AnalyticsEventType.add_to_cart) {
        // Tiebreak only, and only for products that were also *viewed* this day —
        // an add-to-cart never injects a zero-view product into the "top viewed"
        // list. No-ops when the product isn't already present.
        bumpTiebreak(productAcc, ev.productId, 1);
      }
    }
  }

  // Resolve product titles for labels (FR-18). Only the ids that appeared.
  const productIds = Array.from(productAcc.keys());
  if (productIds.length > 0) {
    const titles = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, title: true },
    });
    for (const { id, title } of titles) {
      const acc = productAcc.get(id);
      if (acc && title) acc.label = title;
    }
  }

  const orders = counts[AnalyticsEventType.place_order];
  const conversionRate = conversionRateBps(orders, sessions);

  const summary: RollupSummary = {
    date: iso,
    visitors: visitors.size,
    sessions,
    pageviews: counts[AnalyticsEventType.page_view],
    productViews: counts[AnalyticsEventType.product_view],
    addToCarts: counts[AnalyticsEventType.add_to_cart],
    beginCheckouts: counts[AnalyticsEventType.begin_checkout],
    orders,
    revenueRequested,
    conversionRate,
  };

  const data = {
    visitors: summary.visitors,
    sessions: summary.sessions,
    pageviews: summary.pageviews,
    productViews: summary.productViews,
    addToCarts: summary.addToCarts,
    beginCheckouts: summary.beginCheckouts,
    orders: summary.orders,
    revenueRequested: summary.revenueRequested,
    conversionRate: summary.conversionRate,
    topProducts: topListToJson(topNFromCounts(productAcc)),
    topReferrers: topListToJson(topNFromCounts(referrerAcc)),
    topPages: topListToJson(topNFromCounts(pageAcc)),
  };

  await prisma.dailyMetricRollup.upsert({
    where: { date: pk },
    create: { date: pk, ...data },
    update: data,
  });

  return summary;
}

/**
 * Fold a primary hit (count += `countDelta`, default 1) into a top-N accumulator,
 * creating the entry if absent. Used for the rank metric (`product_view` /
 * `page_view` / referrer host).
 */
function bump(
  acc: Map<string, TopAccumulator>,
  key: string,
  label: string,
  tiebreakDelta: number,
  valuePaiseDelta: number,
  countDelta = 1,
): void {
  const existing = acc.get(key);
  if (existing) {
    existing.count += countDelta;
    existing.tiebreak += tiebreakDelta;
    existing.valuePaise += valuePaiseDelta;
    // Prefer a real label over the bare-key fallback if one arrives later.
    if (existing.label === existing.key && label !== key) existing.label = label;
  } else {
    acc.set(key, {
      key,
      label,
      count: countDelta,
      tiebreak: tiebreakDelta,
      valuePaise: valuePaiseDelta,
    });
  }
}

/**
 * Raise only the secondary tiebreak of an **existing** entry (no-op if the key
 * was never seen as a primary hit). Keeps add-to-cart from injecting a zero-view
 * product into "top products by product_view" (docs/13 FR-18).
 */
function bumpTiebreak(
  acc: Map<string, TopAccumulator>,
  key: string,
  tiebreakDelta: number,
): void {
  const existing = acc.get(key);
  if (existing) existing.tiebreak += tiebreakDelta;
}

/**
 * Roll up every IST day in the inclusive `[from, to]` range (docs/13 FR-20
 * backfill / gap self-heal). Days are processed **sequentially** (oldest first)
 * to bound DB concurrency on the free tier. Order of the supplied instants does
 * not matter; bounds are normalized. Returns one summary per day rolled up.
 *
 * The caller (cron) caps the span (≤14 days, FR-20) before calling this.
 */
export async function rollupRange(from: Date, to: Date): Promise<RollupSummary[]> {
  const a = istDayBounds(from);
  const b = istDayBounds(to);
  const lo = Math.min(a.startUtc.getTime(), b.startUtc.getTime());
  const hi = Math.max(a.startUtc.getTime(), b.startUtc.getTime());

  const summaries: RollupSummary[] = [];
  for (let t = lo; t <= hi; t += MS_PER_DAY) {
    // Use noon-of-day as a DST-proof representative instant (IST has no DST, but
    // noon keeps us clear of any boundary rounding regardless).
    summaries.push(await rollupDay(new Date(t + MS_PER_DAY / 2)));
  }
  return summaries;
}
