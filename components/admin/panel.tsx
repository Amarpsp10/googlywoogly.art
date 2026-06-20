import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * `Panel` — the admin's card/section wrapper. A warm-themed `bg-card` surface
 * with a soft border and `rounded-2xl` corners, with optional header (title +
 * description + action) and footer. Use it to group related content on a page.
 * RSC — presentational only.
 */
export function Panel({
  title,
  description,
  action,
  footer,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const hasHeader = Boolean(title || description || action);
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      {hasHeader ? (
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0 space-y-0.5">
            {title ? (
              <h2 className="font-serif text-base font-semibold text-foreground">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn("px-4 py-4 sm:px-5", bodyClassName)}>{children}</div>
      {footer ? (
        <footer className="border-t border-border px-4 py-3 sm:px-5">{footer}</footer>
      ) : null}
    </section>
  );
}
