"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { nanoid } from "nanoid";
import { AnalyticsEventType } from "@prisma/client";
import type {
  TrackEventInput,
  AnalyticsMetadataValue,
} from "@/lib/validations/analytics";

/**
 * Client analytics emitter (docs/13 §3.2 / FR-4–FR-13). The only client-side
 * analytics module on the storefront: it owns the first-party visitor/session
 * ids, the in-page queue, batching + debounce, the bot/consent gates, and the
 * `navigator.sendBeacon` flush to `POST /api/track-event`.
 *
 * Design contract:
 *  - **Fire-and-forget.** Every public call is wrapped so a thrown analytics
 *    error never propagates to the page (FR-10). The storefront never awaits it.
 *  - **PII-free.** We serialize only the fields on `TrackEventInput`; callers
 *    pass `productId`/`value`/bounded `metadata` only. No form/input/cart-contact
 *    values are ever read (FR-9/FR-30, AC-2).
 *  - **Consent-gated.** With consent denied (or DNT/GPC on) the emitter does not
 *    mint ids, does not enqueue, and does not send (FR-32/FR-33).
 *  - **Tiny + deferred.** No third-party JS; the queue flushes on idle timers +
 *    lifecycle, never blocking navigation (FR-5, AC-14).
 */

// ───────────────────────────── storage keys & tuning ─────────────────────────────

/** First-party pseudonymous device id (docs/13 FR-11). Persisted long-lived. */
const VISITOR_KEY = "gw_vid";
/** Sliding-window visit id (docs/13 FR-12). Per-tab, regenerated after idle. */
const SESSION_KEY = "gw_sid";
/** `lastSeenAt` companion for the sliding session window (epoch ms). */
const SESSION_SEEN_KEY = "gw_sid_seen";
/** Consent decision (docs/13 FR-32). Mirrors `consent-banner.tsx`. */
const CONSENT_KEY = "gw_consent";

/** Session idle timeout: a new `sessionId` is minted after 30m of inactivity. */
const SESSION_IDLE_MS = 30 * 60 * 1000;
/** `gw_vid` cookie lifetime so server-side `place_order` can stitch (FR-11). */
const VISITOR_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60; // 400 days
/** Debounced flush cadence while the queue is non-empty (docs/13 §3.2). */
const FLUSH_DEBOUNCE_MS = 5_000;
/** Flush immediately once the queue reaches this size (docs/13 §3.2). */
const MAX_QUEUE_BEFORE_FLUSH = 20;
/** Hard cap on the in-page queue so a backgrounded tab can't grow unbounded. */
const MAX_QUEUE = 50;

/** `gw_consent` value that fully disables the emitter (essential-only / opt-out). */
const CONSENT_DENIED = "denied";

// ───────────────────────────── public hook surface ─────────────────────────────

/** Optional, PII-free payload accepted by {@link AnalyticsApi.track}. */
export interface TrackOptions {
  /** Soft product reference (no FK). */
  productId?: string;
  /** Monetary value in integer paise where relevant; non-negative. */
  value?: number;
  /** Bounded flat metadata (≤ 12 primitive entries). Never put PII here. */
  metadata?: Record<string, AnalyticsMetadataValue>;
}

/** The hook surface exposed by {@link useAnalytics}. */
export interface AnalyticsApi {
  /** Enqueue a CANON event. No-ops (silently) when consent is denied. */
  track: (type: AnalyticsEventType, opts?: TrackOptions) => void;
}

const AnalyticsContext = createContext<AnalyticsApi | null>(null);

// ───────────────────────────── pure helpers (no React) ─────────────────────────────

/** Bot/automation gate, client side (docs/13 FR-8). Mirrors the server drop list. */
function isLikelyBot(): boolean {
  if (typeof navigator === "undefined") return true;
  // Explicit automation signal (Selenium/Puppeteer/Playwright set this).
  if (navigator.webdriver === true) return true;
  const ua = navigator.userAgent ?? "";
  if (ua.length === 0) return true;
  return /bot\b|crawler|spider|slurp|crawl|headless|phantom|puppeteer|playwright|selenium|lighthouse|prerender|python-requests|curl\/|wget|node-fetch|axios\/|go-http-client|java\/|okhttp|httpie|postmanruntime|scrapy|uptimerobot|pingdom/i.test(
    ua,
  );
}

/**
 * Do-Not-Track / Global-Privacy-Control honoring (docs/13 FR-33): default the
 * beacon OFF for users who signal these. Read defensively across vendor props.
 */
function hasPrivacySignal(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & {
    doNotTrack?: string | null;
    msDoNotTrack?: string | null;
    globalPrivacyControl?: boolean;
  };
  const dnt =
    nav.doNotTrack ??
    (typeof window !== "undefined"
      ? (window as Window & { doNotTrack?: string | null }).doNotTrack
      : null) ??
    nav.msDoNotTrack;
  if (dnt === "1" || dnt === "yes") return true;
  if (nav.globalPrivacyControl === true) return true;
  return false;
}

/** True when the visitor has explicitly opted out (`gw_consent=denied`). */
function isConsentDenied(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === CONSENT_DENIED;
  } catch {
    return false;
  }
}

/**
 * Whether the emitter may run at all. Soft-consent posture (FR-32): analytics is
 * allowed-with-notice by default; only an explicit opt-out, a DNT/GPC signal, or
 * a detected bot disables it. Re-evaluated per flush so toggling consent in the
 * banner takes effect without a reload.
 */
function emitterEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (hasPrivacySignal()) return false;
  if (isConsentDenied()) return false;
  if (isLikelyBot()) return false;
  return true;
}

function readStorage(store: Storage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(store: Storage, key: string, value: string): void {
  try {
    store.setItem(key, value);
  } catch {
    /* storage unavailable / quota — ignore (analytics is best-effort). */
  }
}

/**
 * Mirror `visitorId` into a first-party `gw_vid` cookie (docs/13 FR-11) so the
 * server-side `place_order`/`order_confirmed` path can read it from the request
 * and attach the conversion to the same funnel/session (FR-17). `SameSite=Lax`,
 * `Secure` (on https), `Path=/`, **not** HttpOnly. Pseudonymous — never PII.
 */
function setVisitorCookie(id: string): void {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${VISITOR_KEY}=${encodeURIComponent(id)}; Max-Age=${VISITOR_COOKIE_MAX_AGE_S}; Path=/; SameSite=Lax${secure}`;
  } catch {
    /* cookie write blocked — the localStorage copy still drives the beacon. */
  }
}

/** Ensure a stable first-party `visitorId` (localStorage `gw_vid` + cookie mirror). */
function ensureVisitorId(): string {
  const existing = readStorage(window.localStorage, VISITOR_KEY);
  if (existing && existing.length > 0) {
    // Keep the server-readable cookie alive/refreshed for conversion stitching.
    setVisitorCookie(existing);
    return existing;
  }
  const id = nanoid(21);
  writeStorage(window.localStorage, VISITOR_KEY, id);
  setVisitorCookie(id);
  return id;
}

/**
 * Ensure a `sessionId` for the current visit (sessionStorage `gw_sid`), applying
 * the 30-minute sliding-idle rule (docs/13 FR-12): if the last activity is older
 * than {@link SESSION_IDLE_MS}, mint a fresh id. Renews `lastSeenAt` on each call.
 */
function ensureSessionId(): string {
  const now = Date.now();
  const existing = readStorage(window.sessionStorage, SESSION_KEY);
  const seenRaw = readStorage(window.sessionStorage, SESSION_SEEN_KEY);
  const lastSeen = seenRaw ? Number(seenRaw) : NaN;

  const fresh =
    !existing ||
    existing.length === 0 ||
    !Number.isFinite(lastSeen) ||
    now - lastSeen > SESSION_IDLE_MS;

  const id = fresh ? nanoid(21) : existing;
  if (fresh) writeStorage(window.sessionStorage, SESSION_KEY, id);
  writeStorage(window.sessionStorage, SESSION_SEEN_KEY, String(now));
  return id;
}

/**
 * Build the PII-free `path` for an event (docs/13 FR-9): pathname + an
 * allow-listed subset of the querystring (`utm_*`, `ref`, `q`). The full
 * querystring is **never** serialized — it could carry a token or address.
 */
function safePath(): string {
  try {
    const { pathname, search } = window.location;
    if (!search) return pathname;
    const allowed = new URLSearchParams();
    const params = new URLSearchParams(search);
    for (const [k, v] of params) {
      if (k === "ref" || k === "q" || k.startsWith("utm_")) allowed.set(k, v);
    }
    const qs = allowed.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  } catch {
    return typeof window !== "undefined" ? window.location.pathname : "/";
  }
}

/**
 * Referrer as origin+path with the querystring stripped (docs/13 FR-9). Same-page
 * self-referrals are dropped. Returns `undefined` when absent/unparseable.
 */
function safeReferrer(): string | undefined {
  try {
    const ref = document.referrer;
    if (!ref) return undefined;
    const url = new URL(ref);
    const value = `${url.origin}${url.pathname}`;
    if (value === `${window.location.origin}${window.location.pathname}`) {
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
}

/** Send a batch via `sendBeacon` (preferred) → `fetch(keepalive)` → drop (FR-5). */
function dispatch(events: TrackEventInput[]): void {
  if (events.length === 0) return;
  const url = "/api/track-event";
  const payload = JSON.stringify({ events });
  try {
    const blob = new Blob([payload], { type: "application/json" });
    if (typeof navigator !== "undefined" && navigator.sendBeacon?.(url, blob)) {
      return;
    }
  } catch {
    /* fall through to fetch */
  }
  try {
    void fetch(url, {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      // No credentials needed; the visitorId travels in the body, not a cookie.
      credentials: "omit",
    }).catch(() => {
      /* swallow — analytics loss is acceptable (FR-10). */
    });
  } catch {
    /* drop — never block navigation (FR-5). */
  }
}

// ───────────────────────────── provider ─────────────────────────────

/**
 * Mounts the client emitter (docs/13 §3.2). Place once near the storefront root.
 * Auto-fires `page_view` on pathname change, wires a delegated `wa.me` click →
 * `whatsapp_click` listener, batches everything, and flushes on idle + on
 * `pagehide`/`visibilitychange→hidden` via `sendBeacon`.
 */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Mutable queue + timer live in refs so re-renders never reset them.
  const queueRef = useRef<TrackEventInput[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Send (and clear) the queue now, honoring the consent/bot gate. */
  const flush = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const queue = queueRef.current;
    if (queue.length === 0) return;
    // Re-check at flush time so a just-made opt-out drops the pending batch.
    if (!emitterEnabled()) {
      queueRef.current = [];
      return;
    }
    queueRef.current = [];
    dispatch(queue);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flush();
    }, FLUSH_DEBOUNCE_MS);
  }, [flush]);

  /**
   * Core enqueue. Builds the enriched-by-client (but PII-free) event, gates on
   * consent, and triggers a size/debounce flush. Wrapped so it can never throw
   * into the caller (FR-10).
   */
  const track = useCallback(
    (type: AnalyticsEventType, opts?: TrackOptions) => {
      try {
        if (!emitterEnabled()) return;

        const visitorId = ensureVisitorId();
        const sessionId = ensureSessionId();

        const event: TrackEventInput = {
          visitorId,
          sessionId,
          type,
          path: safePath(),
        };
        const referrer = safeReferrer();
        if (referrer) event.referrer = referrer;
        if (opts?.productId) event.productId = opts.productId;
        if (typeof opts?.value === "number") event.value = opts.value;
        if (opts?.metadata && Object.keys(opts.metadata).length > 0) {
          event.metadata = opts.metadata;
        }

        const queue = queueRef.current;
        queue.push(event);
        // Bound the queue: drop the oldest if a hidden tab let it grow.
        if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);

        if (queue.length >= MAX_QUEUE_BEFORE_FLUSH) flush();
        else scheduleFlush();
      } catch {
        /* analytics must never break the page (FR-10). */
      }
    },
    [flush, scheduleFlush],
  );

  // Auto page_view on every pathname change (initial mount + client nav, FR-2).
  useEffect(() => {
    if (!pathname) return;
    track(AnalyticsEventType.page_view);
  }, [pathname, track]);

  // Lifecycle flush (FR-6): capture the tail when the tab is hidden/closed.
  useEffect(() => {
    const onHide = () => flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      // Best-effort tail flush on unmount (e.g. layout teardown).
      flush();
    };
  }, [flush]);

  // Delegated document click → whatsapp_click for any <a href*="wa.me"> (FR-2).
  // One listener for the whole tree means CTAs added later are covered for free.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      try {
        const target = e.target as Element | null;
        const anchor = target?.closest?.(
          'a[href*="wa.me"]',
        ) as HTMLAnchorElement | null;
        if (!anchor) return;
        track(AnalyticsEventType.whatsapp_click);
        // Navigation is imminent; push the event out now via sendBeacon.
        flush();
      } catch {
        /* swallow */
      }
    };
    // Capture phase so we record even if a handler stops propagation.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [track, flush]);

  const api = useMemo<AnalyticsApi>(() => ({ track }), [track]);

  return (
    <AnalyticsContext.Provider value={api}>
      {children}
    </AnalyticsContext.Provider>
  );
}

/**
 * Access the analytics emitter. Outside an {@link AnalyticsProvider} (e.g. an
 * island not yet wrapped) it returns a safe no-op so callers never crash — a
 * missing tracker must degrade silently, not throw (FR-10).
 */
export function useAnalytics(): AnalyticsApi {
  const ctx = useContext(AnalyticsContext);
  return ctx ?? NOOP_API;
}

const NOOP_API: AnalyticsApi = { track: () => {} };
