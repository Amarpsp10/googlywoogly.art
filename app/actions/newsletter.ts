"use server";

import { headers } from "next/headers";
import { subscribeNewsletter } from "@/lib/services/leads";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

/**
 * Newsletter signup action (doc 05 FR-10). Per-IP rate-limited (5 / 10 min) and
 * gated by Cloudflare Turnstile when configured (docs/16 §6.6 — newsletter is
 * low-friction `[V1]`, so the widget/verify are no-ops until a secret is set).
 * The honeypot remains the third layer in the service. Never throws.
 */

export interface NewsletterState {
  ok: boolean;
  message: string;
}

/** Newsletter throttle: 5 submissions per 10 minutes, keyed by IP. */
const NEWSLETTER_RATE = { limit: 5, windowMs: 10 * 60_000 };
const RATE_LIMITED = "You're sending these a little too fast. Please try again in a few minutes.";
const VERIFICATION_FAILED = "We couldn't verify your submission. Please try again.";

export async function newsletterAction(
  _prev: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const ip = clientIp(await headers());
  if (!rateLimit(`newsletter:${ip}`, NEWSLETTER_RATE).ok) {
    return { ok: false, message: RATE_LIMITED };
  }

  const email = String(formData.get("email") ?? "");
  const website = String(formData.get("website") ?? ""); // honeypot — must stay empty
  const turnstileToken = String(formData.get("turnstileToken") ?? "");

  // Turnstile (no-op when unconfigured). Bind to the caller IP.
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, message: VERIFICATION_FAILED };
  }

  const res = await subscribeNewsletter({ email, source: "footer", website });
  if (res.ok) return { ok: true, message: "Thanks for subscribing! 🎉" };
  return {
    ok: false,
    message: res.error ?? "Something went wrong. Please try again.",
  };
}
