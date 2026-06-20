/**
 * Discriminated result type for Server Actions and service functions.
 * Lets callers handle success/failure without throwing across the
 * server/client boundary, and carries field-level validation errors.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Convert a ZodError `flatten().fieldErrors` shape into an ActionResult. */
export function failValidation(
  fieldErrors: Record<string, string[] | undefined>,
  message = "Please correct the highlighted fields.",
): ActionResult<never> {
  const cleaned: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(fieldErrors)) {
    if (v && v.length) cleaned[k] = v;
  }
  return { ok: false, error: message, fieldErrors: cleaned };
}
