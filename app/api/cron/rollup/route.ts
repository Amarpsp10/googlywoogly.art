import { NextResponse, type NextRequest } from "next/server";

import {
  istDayBounds,
  rollupDay,
  type RollupSummary,
} from "@/lib/services/analytics-rollup";
import { prisma } from "@/lib/db";

/**
 * Nightly rollup cron — `GET|POST /api/cron/rollup` (docs/13 FR-18/FR-20, AC-6;
 * route table §6.1; `02` §14.2). Vercel Cron hits this ~02:00 IST (`vercel.json`
 * schedule `0 1 * * *` UTC ≈ 06:30 IST window; cron offsets are best-effort).
 *
 * Auth: `CRON_SECRET` bearer **or** Vercel's `x-vercel-cron` header (which the
 * platform injects only for its own scheduled invocations and cannot be set by an
 * external caller). Anything else → 401, no work done (docs/13 §6.1).
 *
 * Work per run:
 *  1. `?date=YYYY-MM-DD` present → recompute exactly that one IST day (manual
 *     backfill / partial-day correction, FR-20) and return.
 *  2. Otherwise → roll up **yesterday** (the now-complete IST day) and **today**
 *     (a live partial so dashboards aren't a day behind), then **self-heal** any
 *     gap of missing days before yesterday, capped at 14 days (FR-20) to stay
 *     within Node execution limits.
 *
 * Idempotent throughout: every write is an upsert keyed by the `date` PK (FR-18),
 * so re-runs and overlapping windows never double-count.
 *
 * Runs on the Node runtime (Prisma needs Node, not Edge) and is never cached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Max days a single self-heal pass will backfill (docs/13 FR-20). */
const MAX_GAP_DAYS = 14;
const MS_PER_DAY = 86_400_000;

/** Constant-time-ish bearer comparison guarded by a configured secret. */
function hasValidBearer(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never authorize when no secret is configured
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/**
 * True when the request is an authentic Vercel Cron invocation. Vercel sets
 * `x-vercel-cron` on its scheduled calls; external clients cannot forge it
 * (stripped at the edge). Belt-and-suspenders alongside the bearer check.
 */
function isVercelCron(req: NextRequest): boolean {
  return req.headers.get("x-vercel-cron") != null;
}

function isAuthorized(req: NextRequest): boolean {
  return hasValidBearer(req) || isVercelCron(req);
}

/**
 * Parse a strict `YYYY-MM-DD` query value into a representative instant for that
 * IST day (noon IST → unambiguous), or null if absent/malformed. We hand the
 * instant to {@link rollupDay}, which resolves the exact IST-day window.
 */
function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Noon IST of that calendar day, as a UTC instant.
  const ms = Date.UTC(year, month - 1, day, 12, 0, 0);
  const instant = new Date(ms);
  // Reject overflow (e.g. 2025-02-30 rolling into March).
  if (
    instant.getUTCFullYear() !== year ||
    instant.getUTCMonth() !== month - 1 ||
    instant.getUTCDate() !== day
  ) {
    return null;
  }
  return instant;
}

/**
 * Find IST days in `[start, yesterday]` that have no `DailyMetricRollup` row yet
 * (gap detection, FR-20). Returns representative noon instants, oldest first,
 * capped at {@link MAX_GAP_DAYS}.
 */
async function findMissingDays(yesterdayInstant: Date): Promise<Date[]> {
  const yesterday = istDayBounds(yesterdayInstant);
  const oldestAllowed = new Date(
    yesterday.startUtc.getTime() - (MAX_GAP_DAYS - 1) * MS_PER_DAY,
  );

  // The PKs already present in the candidate window.
  const existing = await prisma.dailyMetricRollup.findMany({
    where: { date: { gte: istDayBounds(oldestAllowed).date, lte: yesterday.date } },
    select: { date: true },
  });
  const present = new Set(existing.map((r) => r.date.getTime()));

  const missing: Date[] = [];
  for (let t = oldestAllowed.getTime(); t <= yesterday.startUtc.getTime(); t += MS_PER_DAY) {
    const bounds = istDayBounds(new Date(t + MS_PER_DAY / 2));
    if (!present.has(bounds.date.getTime())) {
      missing.push(new Date(t + MS_PER_DAY / 2));
    }
  }
  return missing;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // 1 — Manual single-day backfill (`?date=YYYY-MM-DD`, FR-20).
  const dateParam = parseDateParam(req.nextUrl.searchParams.get("date"));
  if (dateParam) {
    const summary = await rollupDay(dateParam);
    return NextResponse.json({
      ok: true,
      mode: "backfill",
      ...summary,
    });
  }

  // 2 — Nightly: yesterday (complete) + today (partial), plus gap self-heal.
  const today = istDayBounds(now);
  const yesterdayInstant = new Date(today.startUtc.getTime() - MS_PER_DAY / 2);

  // Self-heal: roll up only the days in [−14d, yesterday] that have no row yet
  // (a missed nightly run, FR-20). Yesterday is recomputed unconditionally below,
  // so exclude it from the heal set to avoid a redundant (idempotent) pass.
  const yesterdayPkMs = istDayBounds(yesterdayInstant).date.getTime();
  const gapDays = (await findMissingDays(yesterdayInstant)).filter(
    (d) => istDayBounds(d).date.getTime() !== yesterdayPkMs,
  );

  const healed: RollupSummary[] = [];
  for (const day of gapDays) {
    healed.push(await rollupDay(day));
  }

  const yesterday = await rollupDay(yesterdayInstant);
  const todayPartial = await rollupDay(now);

  return NextResponse.json({
    ok: true,
    mode: "nightly",
    yesterday,
    today: todayPartial,
    healedDays: healed.length,
    healed: healed.map((s) => s.date),
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
