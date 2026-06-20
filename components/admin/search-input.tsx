"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * `SearchInput` — debounced URL-driven search box for admin lists. Writes the
 * query into a search param (default `q`) and pushes a new URL, preserving the
 * other params and resetting `page` to 1. RSC list pages read the param from
 * `searchParams` and re-query server-side (no client fetch needed).
 *
 * Accessible: a labelled search input (`role=searchbox` via type), a visible
 * focus ring, and a clear button with an `aria-label`.
 */
export function SearchInput({
  param = "q",
  placeholder = "Search…",
  debounceMs = 300,
  className,
  ariaLabel = "Search",
}: {
  param?: string;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = searchParams.get(param) ?? "";
  const [value, setValue] = React.useState(current);

  // Keep local state in sync if the URL param changes externally (e.g. nav).
  React.useEffect(() => {
    setValue(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const commit = React.useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = next.trim();
      if (trimmed) params.set(param, trimmed);
      else params.delete(param);
      // A new search resets pagination.
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [param, pathname, router, searchParams],
  );

  // Debounce committing the typed value to the URL.
  React.useEffect(() => {
    if (value === current) return;
    const t = setTimeout(() => commit(value), debounceMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, debounceMs]);

  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          "h-10 w-full min-w-0 rounded-xl border border-input bg-background py-2 pl-9 pr-9 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow]",
          "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          // Hide the native search clear (we provide our own).
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            setValue("");
            commit("");
          }}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
