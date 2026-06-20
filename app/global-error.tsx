"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Root error boundary (doc 16 FR-41/FR-43). Catches errors thrown in the root
 * layout itself, so it MUST render its own <html>/<body> — it replaces the
 * whole document. Users see friendly copy only; the real error is logged for
 * Sentry/observability (digest is a non-PII correlation id).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the console (and, in prod, the wired error tracker) without
    // ever showing a stack trace to the visitor.
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background font-sans text-foreground antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">
            Something went wrong
          </h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            We hit an unexpected snag. Please try again — if it keeps happening,
            refreshing the page usually helps.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Try again
            </button>
            <a
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-6 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Back to home
            </a>
          </div>
          {error.digest ? (
            <p className="mt-6 text-xs text-muted-foreground">
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
