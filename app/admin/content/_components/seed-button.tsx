"use client";

import { useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/result";

/**
 * `SeedButton` — fires a one-shot "seed defaults" Server Action (homepage default
 * sections, doc 15 FR-8; recommended FAQs, FR-17). Shows pending state and
 * toasts the created count. The list re-renders via the action's revalidation.
 */
export function SeedButton({
  action,
  label,
  className,
}: {
  action: () => Promise<ActionResult<{ count: number }>>;
  label: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={className}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await action();
          if (res.ok) toast.success(`Added ${res.data.count} item${res.data.count === 1 ? "" : "s"}.`);
          else toast.error(res.error || "Couldn't seed. Try again.");
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
      {label}
    </Button>
  );
}
