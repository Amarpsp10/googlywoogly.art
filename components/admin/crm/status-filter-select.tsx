"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * `StatusFilterSelect` — a URL-driven `<select>` for filtering an admin list by
 * a status param. Changing the selection writes (or clears, for "all") the
 * param, resets `page`, and pushes a new URL; the RSC list reads the param from
 * `searchParams` and re-queries server-side (no client fetch). Mirrors
 * `SearchInput`'s URL contract so filters compose.
 *
 * Shared across the Leads/CRM lists (bulk inquiries, messages, reviews).
 * Accessible: a labelled native control with a visible focus ring.
 */
export function StatusFilterSelect({
  param = "status",
  options,
  allLabel = "All",
  ariaLabel = "Filter by status",
  className,
}: {
  param?: string;
  /** The selectable statuses (value = enum, label = display). */
  options: readonly { value: string; label: string }[];
  /** Label for the "no filter" option. */
  allLabel?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? "";

  const onChange = React.useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set(param, next);
      else params.delete(param);
      params.delete("page"); // a new filter resets pagination
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [param, pathname, router, searchParams],
  );

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={cn(
        "h-10 w-full min-w-0 appearance-none rounded-xl border border-input bg-background pl-3 pr-9 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] sm:w-auto",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        className,
      )}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
