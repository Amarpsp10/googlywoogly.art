"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";

/**
 * `QuickToggle` — a single-tap switch that fires a focused Server Action
 * immediately on change (doc 15 FR-2 "toggles are large switches"; FR-13 one-tap
 * approve/feature). Optimistic: flips locally, calls the action in a transition,
 * reverts + toasts on failure. The action takes `(id, next)` and returns an
 * `ActionResult` so we never throw across the boundary.
 */
export function QuickToggle({
  id,
  checked,
  action,
  label,
  className,
  disabled,
}: {
  id: string;
  checked: boolean;
  action: (id: string, next: boolean) => Promise<ActionResult<unknown>>;
  /** Accessible label for the switch (e.g. "Live", "Published"). */
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  const [optimistic, setOptimistic] = React.useState(checked);
  const [pending, startTransition] = useTransition();

  // Keep in sync if the server value changes after a revalidation.
  React.useEffect(() => setOptimistic(checked), [checked]);

  const onChange = (next: boolean) => {
    setOptimistic(next);
    startTransition(async () => {
      const res = await action(id, next);
      if (!res.ok) {
        setOptimistic(!next); // revert
        toast.error(res.error || "Couldn't update. Try again.");
      }
    });
  };

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Switch
        checked={optimistic}
        onCheckedChange={onChange}
        disabled={disabled || pending}
        aria-label={label}
        className="scale-110"
      />
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}
