import Link from "next/link";
import type { Metadata } from "next";
import { Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/**
 * Global 404 (doc 16 FR-41 "every async route has not-found.tsx"). Rendered by
 * the root layout only (no shop chrome), so it carries its own landmark + links
 * back to safe destinations. Friendly, theme-true copy — no technical detail.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-serif text-7xl font-bold text-primary md:text-8xl">404</p>
      <h1 className="mt-4 font-serif text-2xl font-bold md:text-3xl">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The link may be broken or the page may have moved. Let&apos;s get you back to
        something handmade and lovely.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/">
            <Home aria-hidden />
            Back to home
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/products">
            <Search aria-hidden />
            Browse all gifts
          </Link>
        </Button>
      </div>
    </main>
  );
}
