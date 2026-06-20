import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * `AdminPagination` — compact, crawl-free pager for admin lists. RSC: renders
 * real `<a>`s (navigable without JS) and preserves the current filters by
 * cloning `searchParams` and only overriding `page`. Shows a windowed set of
 * page numbers plus prev/next.
 */

type SP = Record<string, string | string[] | undefined>;

function hrefFor(basePath: string, searchParams: SP, page: number, pageParam: string): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (k === pageParam || v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.set(k, v);
  }
  if (page > 1) sp.set(pageParam, String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function pageWindow(page: number, total: number): number[] {
  const span = 1;
  const pages = new Set<number>([1, total, page]);
  for (let i = page - span; i <= page + span; i++) {
    if (i >= 1 && i <= total) pages.add(i);
  }
  return [...pages].sort((a, b) => a - b);
}

export function AdminPagination({
  page,
  totalPages,
  basePath,
  searchParams,
  pageParam = "page",
  total,
  className,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams: SP;
  pageParam?: string;
  /** Optional total row count, shown as a subtle summary. */
  total?: number;
  className?: string;
}) {
  if (totalPages <= 1) {
    if (typeof total === "number" && total > 0) {
      return (
        <p className={cn("text-xs text-muted-foreground", className)}>
          {total} {total === 1 ? "result" : "results"}
        </p>
      );
    }
    return null;
  }

  const windowed = pageWindow(page, totalPages);
  const linkCls =
    "inline-flex size-9 items-center justify-center rounded-full border border-border text-sm font-medium transition-colors hover:bg-pastel-pink/30";
  const activeCls = "bg-primary text-primary-foreground hover:bg-primary";
  const disabledCls = "pointer-events-none opacity-40";

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex flex-wrap items-center justify-between gap-3", className)}
    >
      {typeof total === "number" ? (
        <p className="text-xs text-muted-foreground">
          {total} {total === 1 ? "result" : "results"} · page {page} of {totalPages}
        </p>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-1.5">
        <Link
          href={hrefFor(basePath, searchParams, page - 1, pageParam)}
          className={cn(linkCls, page <= 1 && disabledCls)}
          aria-label="Previous page"
          rel="prev"
          aria-disabled={page <= 1}
        >
          <ChevronLeft className="size-4" />
        </Link>

        {windowed.map((p, i) => {
          const prev = windowed[i - 1];
          const gap = prev !== undefined && p - prev > 1;
          return (
            <span key={p} className="flex items-center gap-1.5">
              {gap ? <span className="px-0.5 text-muted-foreground">…</span> : null}
              <Link
                href={hrefFor(basePath, searchParams, p, pageParam)}
                className={cn(linkCls, p === page && activeCls)}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </Link>
            </span>
          );
        })}

        <Link
          href={hrefFor(basePath, searchParams, page + 1, pageParam)}
          className={cn(linkCls, page >= totalPages && disabledCls)}
          aria-label="Next page"
          rel="next"
          aria-disabled={page >= totalPages}
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </nav>
  );
}
