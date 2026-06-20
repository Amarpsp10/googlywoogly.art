"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * DPDP-friendly soft-consent banner (docs/13 FR-32). The storefront analytics is
 * strictly first-party, non-advertising, and PII-free, so MVP runs an
 * **allowed-with-notice** posture: the banner exists for transparency, not to
 * block the beacon. "Accept" records consent and dismisses; "Essential only"
 * sets `gw_consent=denied`, which fully disables the beacon + `gw_vid`
 * (`analytics-provider.tsx` re-reads this on every event/flush).
 *
 * Accessible + non-intrusive: it never locks scroll, never covers content
 * (slim, bottom-anchored), is keyboard-focusable, announced via `role="dialog"`
 * + `aria-label`, and respects the existing pink theme tokens.
 */

const CONSENT_KEY = "gw_consent";
const CONSENT_GRANTED = "granted";
const CONSENT_DENIED = "denied";

type Consent = typeof CONSENT_GRANTED | typeof CONSENT_DENIED;

function readConsent(): Consent | null {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === CONSENT_GRANTED || v === CONSENT_DENIED ? v : null;
  } catch {
    return null;
  }
}

function writeConsent(value: Consent): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* storage unavailable — the soft-consent default still applies. */
  }
}

export function ConsentBanner() {
  // Render nothing until mounted (avoids SSR/client mismatch) and only when no
  // choice has been persisted yet.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (readConsent() === null) setOpen(true);
  }, []);

  function decide(value: Consent) {
    writeConsent(value);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie and analytics notice"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6",
        // No scroll-lock, no backdrop — content stays reachable behind it.
        "pointer-events-none",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur",
          "sm:flex-row sm:items-center sm:gap-4 sm:p-4",
        )}
      >
        <span
          aria-hidden
          className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-pastel-pink/40 text-primary sm:flex"
        >
          <Cookie className="size-5" />
        </span>

        <p className="min-w-0 flex-1 text-sm text-muted-foreground text-pretty">
          We use first-party cookies for our own basic analytics. No third-party
          tracking, no ads.{" "}
          <Link
            href="/privacy-policy"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Privacy policy
          </Link>
          .
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={() => decide(CONSENT_DENIED)}
          >
            Essential only
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => decide(CONSENT_GRANTED)}
          >
            Accept
          </Button>
        </div>

        {/* Dismiss = soft accept (notice acknowledged; soft-consent default stays on). */}
        <button
          type="button"
          aria-label="Dismiss notice"
          onClick={() => decide(CONSENT_GRANTED)}
          className={cn(
            "absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-full text-muted-foreground",
            "transition-colors hover:bg-muted hover:text-foreground sm:static sm:size-8",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
