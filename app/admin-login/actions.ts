"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { loginWithPassword } from "@/lib/auth";
import { signInSchema } from "@/lib/validations/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Login Server Action (doc 10 §4.2). Validates with `signInSchema`, verifies
 * credentials via `loginWithPassword` (bcrypt + per-account lockout), and on
 * success redirects to the sanitised `next` path (default `/admin`). Errors are
 * generic (anti-enumeration) and returned as a flat state for `useActionState`.
 *
 * Abuse control (docs/16 FR-23): a per-IP+email sliding-window throttle sits in
 * front of the credential check (≈10 attempts / 15 min) so a single source can't
 * grind passwords across many accounts; the per-account lockout in
 * `loginWithPassword` is the second, durable layer.
 */

/** Login throttle: 10 attempts per 15 minutes, keyed by IP + submitted email. */
const LOGIN_RATE = { limit: 10, windowMs: 15 * 60_000 };
const RATE_LIMITED = "Too many attempts. Please wait a few minutes and try again.";

export interface LoginState {
  ok: boolean;
  /** Error/banner copy. Empty before first submit. */
  message: string;
}

const GENERIC_ERROR = "Invalid email or password.";

/**
 * Accept a `next` path only if it's a same-origin admin path that isn't the
 * login page itself — prevents open-redirect via the login bounce (doc 10 FR-10).
 */
function safeNext(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string") return "/admin";
  // Must be a relative path beginning with "/admin" and not the login page.
  if (!raw.startsWith("/admin")) return "/admin";
  if (raw.startsWith("/admin-login")) return "/admin";
  // Reject protocol-relative / scheme injection (e.g. "/admin\\evil", "//host").
  if (raw.startsWith("//") || raw.includes("\\")) return "/admin";
  return raw;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    website: formData.get("website") ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: GENERIC_ERROR };
  }

  // A filled honeypot ⇒ silently reject as a generic failure (bot signal).
  if (parsed.data.website) {
    return { ok: false, message: GENERIC_ERROR };
  }

  // Per-IP+email throttle. Keyed AFTER validation so the email is normalised;
  // a friendly message (no enumeration) when the window is exhausted.
  const ip = clientIp(await headers());
  const limited = rateLimit(`login:${ip}:${parsed.data.email}`, LOGIN_RATE);
  if (!limited.ok) {
    return { ok: false, message: RATE_LIMITED };
  }

  const result = await loginWithPassword(parsed.data.email, parsed.data.password);

  if (!result.ok) {
    // `loginWithPassword` already returns generic / lockout-aware copy.
    return { ok: false, message: result.error };
  }

  // Success: redirect out of the action (redirect throws internally, so it must
  // be the last thing — outside try/catch).
  redirect(safeNext(formData.get("next")));
}
