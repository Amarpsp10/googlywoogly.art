"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, GripVertical, Home, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/status-badge";
import { cn } from "@/lib/utils";
import { reorderCollections } from "./actions";
import { CollectionRowActions } from "./collection-row-actions";

/**
 * Interactive collections list (docs/11 §4.6). Flat, reorderable rows showing
 * title, `type`, ★home, active state, and member count. Ordering is
 * keyboard-accessible via up/down controls (non-drag fallback, OQ-7) and persists
 * a dense `sortOrder` via `reorderCollections`. Each row carries Edit/Delete.
 */

export interface CollectionListRow {
  id: string;
  title: string;
  slug: string;
  type: "manual" | "automated";
  isActive: boolean;
  isFeaturedOnHome: boolean;
  memberCount: number;
}

export function CollectionList({ collections }: { collections: CollectionListRow[] }) {
  const router = useRouter();
  const [rows, setRows] = React.useState(collections);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => setRows(collections), [collections]);

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    startTransition(async () => {
      const result = await reorderCollections({
        orders: next.map((c, i) => ({ id: c.id, sortOrder: i })),
      });
      if (!result.ok) {
        toast.error(result.error);
        setRows(collections);
      }
      router.refresh();
    });
  }

  return (
    <ul className={cn("space-y-2", pending && "pointer-events-none opacity-70")}>
      {rows.map((c, i) => (
        <li
          key={c.id}
          className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-sm sm:gap-3 sm:px-4"
        >
          <GripVertical className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />

          <div className="flex shrink-0 items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label={`Move ${c.title} up`}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => move(i, 1)}
              disabled={i === rows.length - 1}
              aria-label={`Move ${c.title} down`}
            >
              <ArrowDown className="size-4" />
            </Button>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Layers className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{c.title}</p>
              <p className="truncate text-xs text-muted-foreground">/{c.slug}</p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <StatusBadge
              tone={c.type === "automated" ? "info" : "neutral"}
              label={c.type === "automated" ? "Automated" : "Manual"}
            />
            {c.isFeaturedOnHome ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-accent/60 px-2 py-0.5 text-xs font-medium text-accent-foreground"
                title="Featured on homepage"
              >
                <Home className="size-3" aria-hidden />
                Home
              </span>
            ) : null}
            <StatusBadge
              tone={c.isActive ? "success" : "neutral"}
              label={c.isActive ? "Active" : "Hidden"}
            />
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {c.memberCount} {c.memberCount === 1 ? "item" : "items"}
            </span>
          </div>

          <CollectionRowActions id={c.id} title={c.title} memberCount={c.memberCount} />
        </li>
      ))}
    </ul>
  );
}
