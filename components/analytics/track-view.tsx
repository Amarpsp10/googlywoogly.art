"use client";

import { useEffect, useRef } from "react";
import type { AnalyticsEventType } from "@prisma/client";
import {
  useAnalytics,
  type TrackOptions,
} from "@/components/analytics/analytics-provider";

/**
 * Fire exactly one analytics event on mount (docs/13 FR-2). A drop-in for RSC
 * pages that need a one-shot event the route component can't emit itself —
 * `product_view`, `begin_checkout`, `place_order`, `search`.
 *
 * Idempotency: guarded by a ref so it emits once per mount even under React 19
 * StrictMode's double-invoke in dev, and the empty-dep effect means a parent
 * re-render never re-fires it. (`place_order`/`order_confirmed` revenue is also
 * written server-side and de-duped there — this client view is the funnel-head
 * companion only, never the source of truth for money, FR-17.)
 *
 * PII-free: only `productId` / paise `value` / bounded `metadata` are accepted,
 * exactly the fields the emitter serializes (FR-9/FR-30).
 */
export function TrackView({
  type,
  productId,
  value,
  metadata,
}: {
  type: AnalyticsEventType;
} & TrackOptions) {
  const { track } = useAnalytics();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    track(type, { productId, value, metadata });
    // Intentionally mount-only: this is a one-shot view beacon. Props are stable
    // for a given mounted page; changing them should remount, not re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
