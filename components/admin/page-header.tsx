import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard page heading for admin screens: a serif title, optional description,
 * and an optional right-aligned action slot (e.g. a primary "Add" button).
 * RSC — purely presentational. Mobile-first: the action wraps below the title on
 * narrow screens (doc 10 §3.7 FR-36).
 */
export function AdminPageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
