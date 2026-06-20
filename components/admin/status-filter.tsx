"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * `StatusFilter` — a URL-driven `<select>` for admin list facets (status, stock
 * filter, etc.). Writes the chosen value into a search param (resetting `page`),
 * so the RSC list re-queries server-side. The value `"all"` clears the param.
 * Accessible: a labelled native select (works without extra JS once hydrated).
 */
export function StatusFilter({
  param,
  value,
  options,
  ariaLabel,
  className,
  allValue = "all",
}: {
  param: string;
  value: string;
  options: readonly { value: string; label: string }[];
  ariaLabel: string;
  className?: string;
  /** The option value that means "no filter" and is removed from the URL. */
  allValue?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === allValue) params.delete(param);
    else params.set(param, next);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-10 min-w-0 appearance-none rounded-xl border border-input bg-background px-3 pr-8 text-sm text-foreground",
        "outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
