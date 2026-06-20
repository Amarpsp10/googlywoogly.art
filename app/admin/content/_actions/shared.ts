import "server-only";

import { publicEnv } from "@/lib/env";
import type { ContentFormState } from "../_components/content-form-state";

/**
 * Server-side helpers shared by the content/settings Server Actions. Kept out of
 * the `"use server"` action modules so they can export non-action values
 * (Next requires every export of a `"use server"` file to be an async action).
 */

/** Build an absolute storefront URL for a "View live →" toast link (doc 15 FR-3). */
export function liveUrl(path: string): string {
  const base = publicEnv.siteUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** A successful `ContentFormState` carrying a fresh timestamp + optional live link. */
export function formOk(message: string, viewLive?: string): ContentFormState {
  return { ok: true, message, viewLive, ts: Date.now() };
}

/** A failed `ContentFormState` (general message + optional field errors). */
export function formFail(
  message: string,
  fieldErrors?: Record<string, string[]>,
): ContentFormState {
  return { ok: false, message, fieldErrors, ts: Date.now() };
}

/** Map a Zod `flatten().fieldErrors` into a clean `ContentFormState` failure. */
export function formValidationFail(
  fieldErrors: Record<string, string[] | undefined>,
  message = "Please correct the highlighted fields.",
): ContentFormState {
  const cleaned: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(fieldErrors)) {
    if (v && v.length) cleaned[k] = v;
  }
  return { ok: false, message, fieldErrors: cleaned, ts: Date.now() };
}
