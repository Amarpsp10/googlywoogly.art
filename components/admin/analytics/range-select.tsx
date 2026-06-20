"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * URL-driven date-range selector for the analytics dashboards (docs/13 FR-23).
 * Writes `?range=` and pushes a new URL; the RSC page reads it from
 * `searchParams` and re-queries server-side (no client data fetch). Ships the
 * MVP presets 7d / 30d. Accessible native `<select>` with a visible focus ring.
 */

const OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

export function RangeSelect({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("range") === "30d" ? "30d" : "7d";

  const onChange = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "7d") params.delete("range");
      else params.set("range", next);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Date range"
      className={cn(
        "h-10 w-full min-w-0 appearance-none rounded-xl border border-input bg-background pl-3 pr-9 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] sm:w-auto",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        className,
      )}
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
