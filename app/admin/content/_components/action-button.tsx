"use client";

import * as React from "react";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/result";

/**
 * `ActionButton` — fires a one-shot, id-bound Server Action returning an
 * `ActionResult` (e.g. duplicate a banner, delete a media asset). Shows pending
 * state and toasts the outcome; the list re-renders via the action's
 * revalidation. For *destructive* actions prefer `ConfirmButton`.
 */
export function ActionButton({
  action,
  children,
  successMessage,
  variant = "outline",
  size = "sm",
  className,
  icon,
  "aria-label": ariaLabel,
}: {
  action: () => Promise<ActionResult<unknown>>;
  children?: React.ReactNode;
  successMessage?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  icon?: React.ReactNode;
  "aria-label"?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      aria-label={ariaLabel}
      onClick={() =>
        startTransition(async () => {
          const res = await action();
          if (res.ok) {
            if (successMessage) toast.success(successMessage);
          } else {
            toast.error(res.error || "Something went wrong.");
          }
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </Button>
  );
}
