"use server";

import { requireAdmin } from "@/lib/auth";
import {
  getRealtime,
  serializeRealtime,
  type RealtimeSnapshot,
} from "@/lib/services/analytics-report";

/**
 * Server Action backing the realtime widget's poll (docs/13 FR-28). Re-runs the
 * admin auth gate on every call (a Server Action is a public endpoint — never
 * trust the client), then returns a **plain serializable** snapshot of the
 * bounded 30-minute window. The mapping lives in `serializeRealtime` so this
 * action and the page seed share one shape and can never drift.
 *
 * No PII crosses the boundary — only event type, path, and timestamps.
 */
export async function fetchRealtimeSnapshot(): Promise<RealtimeSnapshot> {
  await requireAdmin();
  return serializeRealtime(await getRealtime());
}
