"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * `SubmitButton` — a form submit button that reflects the enclosing form's
 * pending state via `useFormStatus` (React 19). Disables itself and shows a
 * spinner while the Server Action runs, so feature forms don't re-implement
 * pending UI (doc 10 §3.7). Must be rendered **inside** a `<form>`.
 */
export function SubmitButton({
  children,
  pendingText,
  className,
  disabled,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      variant={variant}
      size={size}
      className={cn("min-h-11", className)}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
