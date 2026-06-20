"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Storefront error boundary (doc 16 FR-41). Renders inside the shop chrome, so
 * it's a contained, on-brand panel offering a retry plus a path home. The cart
 * and the rest of the layout stay intact; we never expose a stack trace.
 */
export default function ShopError({
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
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="font-serif text-2xl font-bold md:text-3xl">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        We couldn&apos;t load this page just now. Please try again — it&apos;s
        usually a passing glitch.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button type="button" size="lg" onClick={() => reset()}>
          <RefreshCw aria-hidden />
          Try again
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">
            <Home aria-hidden />
            Back to home
          </Link>
        </Button>
      </div>
      {error.digest ? (
        <p className="mt-6 text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
    </main>
  );
}
