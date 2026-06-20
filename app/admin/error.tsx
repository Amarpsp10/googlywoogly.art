"use client";

import { useEffect } from "react";
import Link from "next/link";
import { LayoutDashboard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Admin error boundary (doc 16 FR-41, §8.4 "DB unreachable (admin) → error
 * toasts; no partial writes"). Keeps the operator inside the tool with a retry
 * and a route back to the dashboard. No stack trace is shown; the digest is a
 * safe correlation id for the error tracker.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="font-serif text-2xl font-bold md:text-3xl">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        This screen ran into an error. No changes were saved. Try again, or head
        back to the dashboard.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button type="button" size="lg" onClick={() => reset()}>
          <RefreshCw aria-hidden />
          Try again
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/admin">
            <LayoutDashboard aria-hidden />
            Go to dashboard
          </Link>
        </Button>
      </div>
      {error.digest ? (
        <p className="mt-6 text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
