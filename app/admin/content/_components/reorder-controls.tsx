"use client";

import { useTransition } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";

/**
 * `ReorderControls` — up/down nudge buttons for a list row (doc 15 FR-2/FR-8:
 * "reordering uses up/down nudge buttons", mobile-friendly). On click it
 * computes the new dense order by swapping this id with its neighbour and posts
 * the full `orderedIds` to the reorder Server Action (FR-8 re-index on save).
 *
 * Stateless beyond pending: the server revalidates and the list re-renders in
 * the new order, so we don't keep a local copy of the array.
 */
export function ReorderControls({
  ids,
  index,
  action,
  className,
}: {
  /** The current ordered id list (ascending sortOrder). */
  ids: readonly string[];
  /** This row's index within `ids`. */
  index: number;
  action: (orderedIds: string[]) => Promise<ActionResult<unknown>>;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  const move = (delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    startTransition(async () => {
      const res = await action(next);
      if (!res.ok) toast.error(res.error || "Couldn't reorder. Try again.");
    });
  };

  const btn =
    "flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={() => move(-1)}
        disabled={pending || index === 0}
        aria-label="Move up"
        className={btn}
      >
        <ChevronUp className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        disabled={pending || index === ids.length - 1}
        aria-label="Move down"
        className={btn}
      >
        <ChevronDown className="size-4" />
      </button>
    </div>
  );
}
