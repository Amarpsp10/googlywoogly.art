import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type SP = Record<string, string | string[] | undefined>;

function hrefFor(basePath: string, searchParams: SP, page: number): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (k === "page" || v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.set(k, v);
  }
  if (page > 1) sp.set("page", String(page));
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

/** Numbered, crawlable pagination that preserves the current filters. */
export function Pagination({
  page,
  totalPages,
  basePath,
  searchParams,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams: SP;
}) {
  if (totalPages <= 1) return null;
  const windowed = pageWindow(page, totalPages);

  const linkCls =
    "inline-flex size-10 items-center justify-center rounded-full border border-border text-sm font-medium transition-colors hover:bg-pastel-pink/30";
  const activeCls = "bg-primary text-primary-foreground hover:bg-primary";
  const disabledCls = "pointer-events-none opacity-40";

  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-2">
      <Link
        href={hrefFor(basePath, searchParams, page - 1)}
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
          <span key={p} className="flex items-center gap-2">
            {gap && <span className="px-1 text-muted-foreground">…</span>}
            <Link
              href={hrefFor(basePath, searchParams, p)}
              className={cn(linkCls, p === page && activeCls)}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </Link>
          </span>
        );
      })}

      <Link
        href={hrefFor(basePath, searchParams, page + 1)}
        className={cn(linkCls, page >= totalPages && disabledCls)}
        aria-label="Next page"
        rel="next"
        aria-disabled={page >= totalPages}
      >
        <ChevronRight className="size-4" />
      </Link>
    </nav>
  );
}
