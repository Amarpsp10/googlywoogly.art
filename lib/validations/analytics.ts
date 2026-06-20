/**
 * Zod schemas for the analytics ingest boundary (`POST /api/track-event`,
 * docs/13 §3.4 / §6). Pure — no DB, no `server-only` — so it can validate on the
 * Edge runtime and be unit-tested.
 *
 * PRIVACY INVARIANT (docs/13 FR-9, FR-30, AC-2): an event carries **only**
 * pseudonymous, non-identifying fields. There are **no** name/email/phone/
 * address fields, and the event object is `.strict()` so any unknown key
 * (including a smuggled PII field) is rejected. `metadata` is a bounded flat
 * record of primitives and may not contain nested objects where PII could hide.
 */

import { z } from "zod";
import { AnalyticsEventType, DeviceType } from "@prisma/client";

/** Max events accepted per batch on the wire (docs/13 FR-6, FR-15). */
export const MAX_EVENTS_PER_BATCH = 50;

/** Bounds on the free-form `metadata` map (docs/13 FR-3). */
export const MAX_METADATA_KEYS = 12;
export const MAX_METADATA_VALUE_LENGTH = 256;

/** Defensive length caps for free-text-ish columns (non-PII, but bound them). */
const MAX_PATH_LENGTH = 2048;
const MAX_REFERRER_LENGTH = 2048;
const MAX_ID_LENGTH = 64;
const MAX_UTM_VALUE_LENGTH = 200;

/**
 * `metadata` value: a JSON primitive only (string | number | boolean).
 * Disallowing objects/arrays keeps the shape flat (docs/03 §3.5) and removes any
 * place a nested PII payload could be tucked away.
 */
const metadataValueSchema = z.union([
  z.string().max(MAX_METADATA_VALUE_LENGTH),
  z.number().finite(),
  z.boolean(),
]);

export type AnalyticsMetadataValue = z.infer<typeof metadataValueSchema>;

/**
 * Bounded metadata record: ≤ MAX_METADATA_KEYS flat primitive entries
 * (docs/13 FR-3). Empty/`undefined` is allowed.
 */
export const metadataSchema = z
  .record(z.string().max(64), metadataValueSchema)
  .refine((m) => Object.keys(m).length <= MAX_METADATA_KEYS, {
    message: `metadata may contain at most ${MAX_METADATA_KEYS} keys.`,
  });

/** Parsed UTM sub-object on an event (docs/03 §3.5). All fields optional. */
export const utmSchema = z
  .object({
    source: z.string().max(MAX_UTM_VALUE_LENGTH).optional(),
    medium: z.string().max(MAX_UTM_VALUE_LENGTH).optional(),
    campaign: z.string().max(MAX_UTM_VALUE_LENGTH).optional(),
    term: z.string().max(MAX_UTM_VALUE_LENGTH).optional(),
    content: z.string().max(MAX_UTM_VALUE_LENGTH).optional(),
  })
  .strict();

export type UtmInput = z.infer<typeof utmSchema>;

/**
 * A single tracked event.
 *
 * `.strict()` is load-bearing: it rejects any property not named here, which is
 * how the "NO PII fields permitted" rule is enforced structurally — a payload
 * containing `email`, `name`, `phone`, `customerEmail`, etc. fails validation
 * rather than being silently stored.
 */
export const trackEventSchema = z
  .object({
    /** Pseudonymous first-party device id (`gw_vid`, docs/13 FR-11). Required. */
    visitorId: z.string().trim().min(1, "visitorId is required.").max(MAX_ID_LENGTH),
    /** Sliding-window visit id (`gw_sid`, docs/13 FR-12). Optional (minted server-side if absent). */
    sessionId: z.string().trim().min(1).max(MAX_ID_LENGTH).optional(),
    /** Closed CANON taxonomy (docs/13 FR-1). */
    type: z.nativeEnum(AnalyticsEventType),
    /** Page path (pathname + allow-listed query). Required. */
    path: z.string().trim().min(1, "path is required.").max(MAX_PATH_LENGTH),
    /** Referrer origin+path (querystring stripped upstream). Optional. */
    referrer: z.string().trim().max(MAX_REFERRER_LENGTH).optional(),
    /** Soft product reference (no FK). Optional. */
    productId: z.string().trim().min(1).max(MAX_ID_LENGTH).optional(),
    /** Monetary value in **integer paise** where relevant; non-negative. Optional. */
    value: z.number().int().nonnegative().optional(),
    /** Bounded flat metadata (docs/13 FR-3). Optional. */
    metadata: metadataSchema.optional(),
    /** Device class; server may override from the UA (docs/13 FR-13). Optional. */
    device: z.nativeEnum(DeviceType).optional(),
    /** ISO country (geo). Optional. */
    country: z.string().trim().length(2).toUpperCase().optional(),
    /** Parsed UTM (server may override from the path). Optional. */
    utm: utmSchema.optional(),
  })
  .strict();

export type TrackEventInput = z.infer<typeof trackEventSchema>;

/**
 * Batch payload (docs/13 FR-6). Capped at MAX_EVENTS_PER_BATCH; at least one
 * event required. The route truncates oversized batches before calling this in
 * lenient mode, but the schema enforces the hard cap defensively.
 */
export const trackEventBatchSchema = z
  .object({
    events: z.array(trackEventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
  })
  .strict();

export type TrackEventBatchInput = z.infer<typeof trackEventBatchSchema>;
