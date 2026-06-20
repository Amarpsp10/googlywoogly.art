/**
 * Pure helpers for human-friendly order numbers and unguessable tracking tokens.
 *
 * - `orderNumber` is `GW-{YYYY}-{zero-padded seq}` (CANON §10; `08` FR-27). The
 *   year is the **IST** calendar year and the sequence is a per-year counter,
 *   zero-padded to a minimum width of 5 (e.g. `GW-2026-00042`).
 * - `trackingToken` is an unguessable, URL-safe nanoid (24 chars; CANON §10;
 *   `08` FR-28). It is the only key to `/order/confirmed/[token]` and
 *   `/track/[token]`; never sequential, never indexed.
 *
 * This module is PURE (no DB, no `server-only`) so it is unit-testable and can
 * run anywhere. The DB-side counter increment lives in the placement action.
 */
import { nanoid } from "nanoid";

/** Brand prefix for all order numbers (CANON §10). */
export const ORDER_NUMBER_PREFIX = "GW";

/** Minimum zero-pad width of the per-year sequence (CANON §10: `00042`). */
export const ORDER_SEQ_MIN_WIDTH = 5;

/** Length (chars) of a generated tracking token (CANON §10: 24+). */
export const TRACKING_TOKEN_LENGTH = 24;

/**
 * Format a per-year sequence into a customer-facing order number.
 *
 * @param year  IST calendar year (e.g. `2026`).
 * @param seq   1-based per-year sequence; zero-padded to >= 5 digits. Sequences
 *              that already exceed the pad width are rendered in full.
 * @returns e.g. `formatOrderNumber(2026, 42) === "GW-2026-00042"`.
 */
export function formatOrderNumber(year: number, seq: number): string {
  const padded = String(seq).padStart(ORDER_SEQ_MIN_WIDTH, "0");
  return `${ORDER_NUMBER_PREFIX}-${year}-${padded}`;
}

/** Structured parts of a parsed order number. */
export interface ParsedOrderNumber {
  year: number;
  seq: number;
}

/**
 * Parse a `GW-{YYYY}-{seq}` order number back into `{ year, seq }`.
 * Returns `null` for anything that does not match the canonical shape, so
 * callers never have to try/catch.
 */
export function parseOrderNumber(orderNumber: string): ParsedOrderNumber | null {
  const match = /^GW-(\d{4})-(\d{5,})$/.exec(orderNumber.trim());
  if (!match) return null;
  return { year: Number(match[1]), seq: Number(match[2]) };
}

/**
 * Generate an unguessable, URL-safe tracking token (default 24 chars). nanoid's
 * default alphabet is `A-Za-z0-9_-`, all URL-safe. Collisions are astronomically
 * unlikely; the unique DB constraint + one retry guards the placement path.
 */
export function generateTrackingToken(size: number = TRACKING_TOKEN_LENGTH): string {
  return nanoid(size);
}
