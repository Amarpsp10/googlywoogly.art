/**
 * In-memory sliding-window rate limiter (docs/16 FR-23 / §6.3).
 *
 * `rateLimit(key, { limit, windowMs })` records one hit for `key` and reports
 * whether the caller is still within budget, how many requests remain, and (when
 * blocked) how long until the window frees up. The window is a true *sliding*
 * window: we keep the timestamps of recent hits and drop any older than
 * `windowMs` on every call, so there is no fixed-bucket boundary burst.
 *
 * Callers supply the key — typically `"<route>:<ip>"` (or `+email` for login) —
 * via {@link clientIp}. Keep keys coarse enough to bound memory (one entry per
 * active key) and specific enough to isolate abusers.
 *
 * ⚠️ IN-MEMORY ⇒ PER-INSTANCE. On Vercel/serverless each lambda + each region
 * has its own module memory, so this limiter is best-effort abuse control for
 * the MVP, NOT a global guarantee. For production multi-instance enforcement,
 * back this with a shared store — Upstash Redis or Vercel KV — keyed identically
 * (docs/16 §6.3, OQ "durable rate-limit/queue" → [V1]). The call sites are
 * written against {@link RateLimitResult} so swapping the backend is local.
 */

export interface RateLimitOptions {
  /** Max number of hits permitted within `windowMs`. */
  limit: number;
  /** Sliding window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  /** `true` when this hit is within budget; `false` when the window is exhausted. */
  ok: boolean;
  /** Hits still allowed in the current window after this call (never negative). */
  remaining: number;
  /**
   * Milliseconds until at least one slot frees up. `0` when `ok` (nothing to
   * wait for); otherwise the time until the oldest in-window hit ages out.
   */
  retryAfterMs: number;
}

/**
 * Per-key ring of recent hit timestamps (ms epoch), oldest first. We store the
 * raw timestamps rather than a counter so the window can slide precisely.
 */
const buckets = new Map<string, number[]>();

/**
 * Guard against unbounded growth from one-off keys: when the map gets large we
 * sweep out keys whose newest hit is already older than this. Cheap and only
 * runs past the threshold, so the hot path stays O(1)-ish.
 */
const MAX_TRACKED_KEYS = 10_000;

/**
 * Record a hit for `key` and evaluate it against a sliding window. Pure
 * book-keeping — never throws, never does IO. Safe to call from any Server
 * Action or Route Handler before the real work.
 */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const { limit, windowMs } = options;
  const now = Date.now();
  const windowStart = now - windowMs;

  // Drop timestamps that have aged out of the window.
  const previous = buckets.get(key);
  const hits = previous ? previous.filter((t) => t > windowStart) : [];

  if (hits.length >= limit) {
    // Blocked: the window is full. The earliest hit dictates when a slot frees.
    const oldest = hits[0];
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    // Persist the pruned list so a long idle gap can't strand stale timestamps.
    buckets.set(key, hits);
    return { ok: false, remaining: 0, retryAfterMs };
  }

  hits.push(now);
  buckets.set(key, hits);

  if (buckets.size > MAX_TRACKED_KEYS) sweep(windowStart);

  return { ok: true, remaining: limit - hits.length, retryAfterMs: 0 };
}

/**
 * Remove keys whose most-recent hit predates `windowStart` (i.e. fully idle).
 * Bounds memory for sprawling key spaces (e.g. per-IP). Best-effort GC.
 */
function sweep(windowStart: number): void {
  for (const [key, hits] of buckets) {
    if (hits.length === 0 || hits[hits.length - 1] <= windowStart) {
      buckets.delete(key);
    }
  }
}

/**
 * TEST-ONLY: drop all tracked windows so tests don't bleed state into each
 * other. Not part of the production contract.
 */
export function __resetRateLimit(): void {
  buckets.clear();
}

/**
 * Derive a best-effort client IP from request headers. Prefers the FIRST
 * address in `x-forwarded-for` (the original client; proxies append their own
 * hops), then falls back to `x-real-ip`. Returns `"unknown"` when nothing is
 * present so the key is always a stable, non-empty string (a shared `"unknown"`
 * bucket fails safe — it throttles harder, never opens the gate).
 *
 * Accepts a `Headers` instance or any `{ get(name) }` shape (Next's `headers()`
 * result, a `NextRequest.headers`, a plain object adapter).
 */
export function clientIp(
  headers: Headers | { get(name: string): string | null },
): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // "client, proxy1, proxy2" → first non-empty segment.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();
  return "unknown";
}
