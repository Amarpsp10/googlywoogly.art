import { NextResponse, type NextRequest } from "next/server";
import { recordEvents } from "@/lib/services/analytics";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * `POST /api/track-event` — public, unauthenticated analytics ingest (docs/13
 * §3.4 / FR-4–FR-15). The client beacon (`components/analytics/analytics-provider`)
 * posts a `{ events: [...] }` batch via `navigator.sendBeacon` (a `Blob` of
 * `application/json`) or `fetch(keepalive)`; this handler validates it, hands it
 * to the server-only `recordEvents`, and returns **204 No Content** so the
 * fire-and-forget beacon never waits on or reacts to a body (FR-5/FR-10).
 *
 * Privacy (FR-9/FR-30, AC-2): nothing identifying is stored. The body carries
 * only pseudonymous fields, the schema is `.strict()` (smuggled PII keys are
 * rejected), and the shopper IP is never persisted — `recordEvents` documents it
 * as transient. We pass through only the `User-Agent` for the authoritative
 * server-side bot gate + device enrichment (FR-8/FR-13).
 *
 * Resilience: this route **never throws to the client**. An oversize or invalid
 * body yields `400` with **no body**; a malformed JSON parse or any downstream
 * error is swallowed to `400`/`204` respectively — an analytics failure must
 * never surface as a user-visible error (FR-10).
 */

export const runtime = "nodejs";
// Pure ingest: never cache, never prerender. Each request is a side-effecting write.
export const dynamic = "force-dynamic";

/**
 * Hard cap on the accepted request body (~64 KB). A batch is ≤ 50 small events
 * (validations/analytics `MAX_EVENTS_PER_BATCH`), so anything larger is abusive
 * or malformed and is rejected before we spend cycles parsing JSON (FR-15).
 */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Per-IP ingest throttle (docs/16 FR-23): generous (120 / min) because a normal
 * browsing session batches many events; well above legitimate traffic, so it only
 * bites a flood. Exceeding it returns **429 (no body)** — the beacon ignores it.
 */
const TRACK_RATE = { limit: 120, windowMs: 60_000 };

/** 204 No Content — the canonical "accepted, nothing to say" beacon response. */
function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/** 400 Bad Request with no body — oversize/invalid; the client ignores it anyway. */
function badRequest(): NextResponse {
  return new NextResponse(null, { status: 400 });
}

/** 429 Too Many Requests with no body — over the per-IP ingest budget. */
function tooManyRequests(): NextResponse {
  return new NextResponse(null, { status: 429 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Abuse control first: a per-IP flood is dropped before any parsing/DB work.
  const ip = clientIp(request.headers);
  if (!rateLimit(`track:${ip}`, TRACK_RATE).ok) {
    return tooManyRequests();
  }

  // Cheap pre-parse guard: reject an oversized declared body up front (FR-15).
  const declaredLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return badRequest();
  }

  let body: unknown;
  try {
    // `sendBeacon` sends a Blob with `type: application/json`; `request.json()`
    // parses it regardless of the exact content-type the browser stamps on it.
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return badRequest();
    if (raw.length === 0) return badRequest();
    body = JSON.parse(raw);
  } catch {
    // Malformed JSON / read error — reject, never throw to the client.
    return badRequest();
  }

  try {
    // `recordEvents` validates with `trackEventBatchSchema`, runs the bot gate,
    // and persists enriched rows. It returns a result object and does not throw
    // for invalid/bot/empty batches — but we still wrap it defensively.
    const result = await recordEvents(body, {
      ua: request.headers.get("user-agent") ?? undefined,
    });

    // A schema-invalid batch is the one client-correctable case → 400 (no body).
    // Bot/empty/accepted all return 204: the beacon can do nothing useful with
    // the distinction, and surfacing it would only invite probing.
    if (!result.accepted && result.reason === "invalid") {
      return badRequest();
    }
    return noContent();
  } catch {
    // Any unexpected DB/runtime error must not become a user-visible failure
    // (FR-10): swallow and acknowledge. Observability lives server-side (Sentry).
    return noContent();
  }
}
