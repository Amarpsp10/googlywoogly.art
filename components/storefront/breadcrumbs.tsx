import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("mb-6", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {items.map((it, i) => (
          <li key={`${it.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
            {it.href ? (
              <Link href={it.href} className="transition-colors hover:text-primary">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-foreground">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
