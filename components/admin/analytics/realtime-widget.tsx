"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Activity, RefreshCw } from "lucide-react";
import type { AnalyticsEventType } from "@prisma/client";

import { cn } from "@/lib/utils";
import type { RealtimeSnapshot } from "@/lib/services/analytics-report";
import { fetchRealtimeSnapshot } from "./realtime-actions";

/**
 * "Right now" realtime widget (docs/13 FR-28) — a compact **client leaf** seeded
 * with an initial server snapshot, then self-refreshing every 15s via a Server
 * Action. Polling **pauses when the tab is hidden** (and refreshes once on
 * re-show) to stay free-tier-friendly. Shows active visitors/sessions, a capped
 * live event feed, and top active pages.
 *
 * All data is non-identifying (event type + path + relative time).
 */

const POLL_MS = 15_000;

/** Short human labels for the live feed (closed CANON taxonomy). */
const EVENT_LABEL: Partial<Record<AnalyticsEventType, string>> = {
  page_view: "Viewed page",
  product_view: "Viewed product",
  category_view: "Viewed category",
  collection_view: "Viewed collection",
  search: "Searched",
  filter_apply: "Filtered",
  add_to_cart: "Added to cart",
  remove_from_cart: "Removed from cart",
  update_cart: "Updated cart",
  begin_checkout: "Began checkout",
  place_order: "Placed order",
  order_confirmed: "Order confirmed",
  whatsapp_click: "WhatsApp click",
  bulk_inquiry_submit: "Bulk inquiry",
  contact_submit: "Contact form",
  newsletter_signup: "Newsletter signup",
  outbound_click: "Outbound click",
};

function labelFor(type: AnalyticsEventType): string {
  return EVENT_LABEL[type] ?? type.replace(/_/g, " ");
}

/** Compact "Ns/Nm ago" from an epoch-ms timestamp, relative to `now`. */
function relTime(at: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - at) / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

export function RealtimeWidget({ initial }: { initial: RealtimeSnapshot }) {
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot>(initial);
  const [isPending, startTransition] = useTransition();
  // A monotonic "now" so relative labels recompute on each poll/tick.
  const [now, setNow] = useState<number>(() => Date.now());
  const inFlight = useRef(false);

  const refresh = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    startTransition(async () => {
      try {
        const next = await fetchRealtimeSnapshot();
        setSnapshot(next);
        setNow(Date.now());
      } catch {
        // Transient failure — keep the last good snapshot, try again next tick.
      } finally {
        inFlight.current = false;
      }
    });
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        setNow(Date.now());
        if (!document.hidden) refresh();
      }, POLL_MS);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        refresh(); // catch up immediately on re-show
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const live = snapshot.activeVisitors > 0;

  return (
    <section
      aria-label="Realtime activity"
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-2.5" aria-hidden>
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75",
                live && "animate-ping bg-primary",
              )}
            />
            <span
              className={cn(
                "relative inline-flex size-2.5 rounded-full",
                live ? "bg-primary" : "bg-muted-foreground/40",
              )}
            />
          </span>
          <h2 className="font-serif text-base font-semibold text-foreground">
            Right now
          </h2>
          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            <span className="font-semibold text-foreground tabular-nums">
              {snapshot.activeVisitors}
            </span>{" "}
            active {snapshot.activeVisitors === 1 ? "visitor" : "visitors"} ·{" "}
            <span className="tabular-nums">{snapshot.activeSessions}</span> sessions
            <span className="sr-only"> in the last {snapshot.windowMinutes} minutes</span>
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-60"
          aria-label="Refresh realtime activity"
        >
          <RefreshCw className={cn("size-3.5", isPending && "animate-spin")} aria-hidden />
          <span className="max-sm:sr-only">Refresh</span>
        </button>
      </header>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Live event feed */}
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Live feed
          </p>
          {snapshot.recentEvents.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
              <Activity className="size-4 shrink-0" aria-hidden />
              No activity in the last {snapshot.windowMinutes} minutes.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {snapshot.recentEvents.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="min-w-0 truncate text-foreground">
                    <span className="font-medium">{labelFor(e.type)}</span>{" "}
                    <span className="text-muted-foreground">{e.path}</span>
                  </span>
                  <time
                    className="shrink-0 tabular-nums text-muted-foreground"
                    dateTime={new Date(e.at).toISOString()}
                  >
                    {relTime(e.at, now)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top active pages */}
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Top active pages
          </p>
          {snapshot.topActivePages.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
              No page views yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {snapshot.topActivePages.map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-foreground">{p.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {p.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
