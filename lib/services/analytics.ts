import "server-only";

import { Prisma, type DeviceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  trackEventBatchSchema,
  type TrackEventInput,
} from "@/lib/validations/analytics";
import {
  deviceFromUserAgent,
  isBot,
  hasUtm,
  parseUtm,
  type Utm,
} from "@/lib/analytics/events";

/**
 * Server-only analytics ingest + rollup reads (docs/13 §3.3–§3.6).
 *
 * Privacy posture (docs/13 FR-30/FR-31, AC-2): we persist ONLY pseudonymous,
 * non-identifying fields. The shopper IP that the route may pass in `ctx.ip` is
 * used **transiently** (geo/rate-limit upstream) and is **NEVER** written to any
 * row here. No name/email/phone/address ever reaches `AnalyticsEvent`.
 *
 * Pure logic (UA/UTM parsing, funnel maths) lives in `@/lib/analytics/events`
 * and `@/lib/validations/analytics` so it stays unit-testable; this module only
 * adds DB access.
 */

// Re-export the pure funnel computation so dashboard RSCs can import it from the
// service alongside `getDailyRollups` without reaching into the pure module.
export {
  computeFunnel,
  type Funnel,
  type FunnelStep,
  type FunnelRollupInput,
} from "@/lib/analytics/events";

/**
 * Request context for ingest. `ua` drives device enrichment + the authoritative
 * bot gate (docs/13 FR-8/FR-13). `country` comes from the platform geo header
 * (country only). `ip` is accepted for signature completeness but is documented
 * as transient and is never stored.
 */
export interface IngestContext {
  /** Raw `User-Agent` header. */
  ua?: string | null;
  /** ISO country from the geo header (e.g. `x-vercel-ip-country`), country only. */
  country?: string | null;
  /**
   * Shopper IP — **transient only** (geo/rate-limit happen upstream). This
   * function never persists it. Present so callers needn't strip it themselves.
   */
  ip?: string | null;
}

/** Outcome of {@link recordEvents}. Counts are useful for logging/metrics, not the client. */
export interface RecordEventsResult {
  /** True when the batch passed validation and was not bot traffic. */
  accepted: boolean;
  /** Number of `AnalyticsEvent` rows inserted. */
  eventsWritten: number;
  /** True when the request was dropped as bot/crawler traffic (docs/13 FR-8). */
  droppedAsBot: boolean;
  /** Reason when nothing was written (`bot` | `invalid` | `empty`). */
  reason?: "bot" | "invalid" | "empty";
}

const PAGE_VIEW = "page_view" as const;

type JsonOrNull = Prisma.InputJsonValue | typeof Prisma.JsonNull;

/** Normalize a parsed-UTM object to a JSON column value (null when empty). */
function utmToJson(utm: Utm): JsonOrNull {
  return hasUtm(utm) ? (utm as Prisma.InputJsonValue) : Prisma.JsonNull;
}

/** Normalize bounded metadata to a JSON column value (null when absent/empty). */
function metadataToJson(
  metadata: TrackEventInput["metadata"],
): JsonOrNull {
  if (!metadata || Object.keys(metadata).length === 0) return Prisma.JsonNull;
  return metadata as Prisma.InputJsonValue;
}

/**
 * Pick the UTM for an event: prefer what the client sent (already allow-listed),
 * else parse it from the event `path` server-side (docs/13 FR-13). The client is
 * never trusted as the sole source — parsing the path is the fallback.
 */
function resolveUtm(ev: TrackEventInput): Utm {
  const fromClient: Utm = ev.utm ?? {};
  if (hasUtm(fromClient)) return fromClient;
  return parseUtm(ev.path);
}

/**
 * Ingest a batch of client analytics events (docs/13 FR-8/FR-13/FR-14):
 *  1. Validate the batch (Zod); a malformed batch is dropped, never thrown.
 *  2. Drop the whole request if the UA is a bot/crawler/headless (authoritative
 *     server gate) — bot traffic must never inflate metrics.
 *  3. Upsert the `AnalyticsSession` (create with first-touch acquisition fields;
 *     on revisit bump `lastSeenAt` + increment `pageviews` by the count of
 *     `page_view` events in the batch).
 *  4. Insert the enriched `AnalyticsEvent` rows (server `device`/`country`/`utm`;
 *     `createdAt` defaults to server receipt time).
 *
 * Conversion (`isConverted`/`orderId`) is owned by the server-side `place_order`
 * path, not this beacon ingest (docs/13 FR-14/FR-17). All events in a batch are
 * assumed to share one `(visitorId, sessionId)` per the client emitter contract.
 */
export async function recordEvents(
  batch: unknown,
  ctx: IngestContext,
): Promise<RecordEventsResult> {
  // 2 (early) — authoritative bot gate. Drop before touching the DB.
  if (isBot(ctx.ua)) {
    return { accepted: false, eventsWritten: 0, droppedAsBot: true, reason: "bot" };
  }

  // 1 — validate. A bad batch is dropped (lenient ingest, docs/13 FR-15).
  const parsed = trackEventBatchSchema.safeParse(batch);
  if (!parsed.success) {
    return { accepted: false, eventsWritten: 0, droppedAsBot: false, reason: "invalid" };
  }
  const events = parsed.data.events;
  if (events.length === 0) {
    return { accepted: false, eventsWritten: 0, droppedAsBot: false, reason: "empty" };
  }

  // Server-side enrichment (client is not trusted for these — docs/13 FR-13).
  const device: DeviceType = deviceFromUserAgent(ctx.ua);
  const country = normalizeCountry(ctx.country);

  // Group by sessionId so each session is one upsert + its events. The client
  // emitter sends one session per batch, but we stay correct if it ever mixes.
  const bySession = new Map<string | null, TrackEventInput[]>();
  for (const ev of events) {
    const key = ev.sessionId ?? null;
    const list = bySession.get(key);
    if (list) list.push(ev);
    else bySession.set(key, [ev]);
  }

  let eventsWritten = 0;

  for (const [sessionId, group] of bySession) {
    const first = group[0];
    const visitorId = first.visitorId;
    const pageViewCount = group.filter((e) => e.type === PAGE_VIEW).length;
    const acquisitionUtm = resolveUtm(first);

    // One transaction per session keeps the upsert + counter bump + inserts
    // atomic and minimal (docs/13 FR-14).
    const writes: Prisma.PrismaPromise<unknown>[] = [];

    if (sessionId) {
      writes.push(
        prisma.analyticsSession.upsert({
          where: { id: sessionId },
          create: {
            id: sessionId,
            visitorId,
            landingPath: first.path,
            referrer: first.referrer ?? null,
            utm: utmToJson(acquisitionUtm),
            device,
            country,
            // startedAt defaults to now(); first event in the batch is the landing.
            lastSeenAt: new Date(),
            pageviews: pageViewCount,
          },
          update: {
            // First-touch wins: acquisition fields (landingPath/referrer/utm) are
            // NOT overwritten on revisit. Only liveness + counters move.
            lastSeenAt: new Date(),
            pageviews: { increment: pageViewCount },
          },
        }),
      );
    }

    for (const ev of group) {
      writes.push(
        prisma.analyticsEvent.create({
          data: {
            visitorId: ev.visitorId,
            // FK to AnalyticsSession; only set when we created/updated that row.
            sessionId: sessionId ?? null,
            type: ev.type,
            path: ev.path,
            referrer: ev.referrer ?? null,
            productId: ev.productId ?? null,
            value: ev.value ?? null,
            metadata: metadataToJson(ev.metadata),
            device,
            country,
            utm: utmToJson(resolveUtm(ev)),
            // createdAt defaults to server now() — the trusted timestamp (FR-13).
          },
        }),
      );
    }

    await prisma.$transaction(writes);
    eventsWritten += group.length;
  }

  return { accepted: true, eventsWritten, droppedAsBot: false };
}

/** Two-letter uppercase ISO country, or null if absent/malformed. */
function normalizeCountry(country?: string | null): string | null {
  if (!country) return null;
  const c = country.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

/** A `DailyMetricRollup` row as read for dashboards. */
export type DailyRollup = Prisma.DailyMetricRollupGetPayload<true>;

/**
 * Read the daily rollups in the inclusive `[fromDate, toDate]` range, ordered by
 * date ascending (docs/13 FR-22). Dashboards sum these columns; they never scan
 * the raw event firehose at request time.
 *
 * `fromDate`/`toDate` are treated as calendar-day bounds against the `date` PK
 * (`@db.Date`). Pass dates whose UTC day equals the intended IST day boundary
 * (the cron writes one row per IST calendar day — docs/13 FR-18).
 */
export async function getDailyRollups(
  fromDate: Date,
  toDate: Date,
): Promise<DailyRollup[]> {
  return prisma.dailyMetricRollup.findMany({
    where: { date: { gte: fromDate, lte: toDate } },
    orderBy: { date: "asc" },
  });
}
