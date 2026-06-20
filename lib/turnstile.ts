import "server-only";

/**
 * Cloudflare Turnstile server-side verification (docs/16 §6.6 / FR-24).
 *
 * `verifyTurnstile(token, ip?)` calls Cloudflare's `siteverify` endpoint to
 * confirm a client-rendered Turnstile token is genuine BEFORE a Server Action
 * does any write. Privacy-friendly CAPTCHA (no behavioural tracking), preferred
 * over reCAPTCHA (DPDP-aligned).
 *
 * GRACEFUL NO-OP: when `TURNSTILE_SECRET_KEY` is unset (local dev, preview
 * without the integration), this returns `true` so forms keep working — the
 * honeypot + time-trap + rate limit still apply. Bot protection via Turnstile is
 * therefore opt-in by configuration, never a hard dependency.
 *
 * `server-only`: the secret must never reach a client bundle (FR-25). The widget
 * SITE key (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`) is the public half and lives in the
 * forms.
 */

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Shape of the `siteverify` JSON response we care about. */
interface SiteVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

/**
 * Verify a Turnstile `token`. Returns `true` when the challenge passes (or when
 * Turnstile is unconfigured); `false` for a missing/invalid/expired token or any
 * verification error. NEVER throws — a network hiccup fails closed (`false`) so a
 * configured deployment doesn't silently accept unverified submissions, but the
 * unconfigured path stays open for dev.
 *
 * @param token  The `cf-turnstile-response` token from the client widget.
 * @param ip     Optional remote IP (`remoteip`) to bind the verification.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  ip?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Unconfigured ⇒ graceful pass-through (dev/preview without the integration).
  if (!secret) return true;

  // Configured but no token ⇒ definitively fail (widget should always supply one).
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      // Verification must reflect live state; never cache.
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as SiteVerifyResponse;
    return data.success === true;
  } catch {
    // Network/parse failure: fail closed for a configured deployment.
    return false;
  }
}
