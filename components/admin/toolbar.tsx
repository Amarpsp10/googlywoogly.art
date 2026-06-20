import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * `Toolbar` — a horizontal strip above a list/table for filters, search, and
 * actions. Wraps gracefully on mobile (filters stack, the trailing actions move
 * below). RSC; place client controls (SearchInput, selects) inside it.
 */
export function Toolbar({
  children,
  end,
  className,
}: {
  /** Leading controls — filters, search, etc. */
  children?: ReactNode;
  /** Trailing controls — primary actions, pinned to the right on wide screens. */
  end?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {children}
      </div>
      {end ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{end}</div>
      ) : null}
    </div>
  );
}
