"use client";

import { useActionState, useEffect } from "react";
import Script from "next/script";
import { toast } from "sonner";
import { newsletterAction, type NewsletterState } from "@/app/actions/newsletter";
import { publicEnv } from "@/lib/env";

const initial: NewsletterState = { ok: false, message: "" };

// Cloudflare Turnstile script (loaded once when a site key is configured).
const TURNSTILE_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js";

export function NewsletterForm() {
  const [state, action, pending] = useActionState(newsletterAction, initial);
  const siteKey = publicEnv.turnstileSiteKey;

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <form action={action} className="flex flex-wrap gap-2">
      <input
        type="email"
        name="email"
        required
        placeholder="Your email"
        aria-label="Email address"
        className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      {/* honeypot */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      {/* Cloudflare Turnstile — only when configured. Implicit render injects a
          hidden `turnstileToken` input into this form, verified server-side. */}
      {siteKey && (
        <>
          <Script src={TURNSTILE_SRC} strategy="lazyOnload" />
          <div
            className="cf-turnstile basis-full"
            data-sitekey={siteKey}
            data-response-field-name="turnstileToken"
            data-size="flexible"
          />
        </>
      )}
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "…" : "Subscribe"}
      </button>
    </form>
  );
}
