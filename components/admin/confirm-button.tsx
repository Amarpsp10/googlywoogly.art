"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/**
 * `ConfirmButton` — a destructive action button that pops a confirm dialog
 * before running (doc 10 FR-36 "single-tap status change with confirm sheet").
 * The action is invoked by submitting an internal `<form action={action}>`, so
 * it composes with Server Actions and shows pending state automatically.
 *
 * Pass `action` (a Server Action) and optionally `hiddenFields` (e.g. the entity
 * id) that get serialised into the form. The trigger label is `children`.
 */
export function ConfirmButton({
  action,
  hiddenFields,
  children,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  variant,
  size = "sm",
  className,
  ...props
}: {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Record<string, string>;
  children: React.ReactNode;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true (default) the confirm button is styled destructive. */
  destructive?: boolean;
} & Omit<React.ComponentProps<typeof Button>, "action">) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={variant ?? (destructive ? "outline" : "secondary")}
          size={size}
          className={cn("min-h-9", className)}
          {...props}
        >
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl">
        <form action={action}>
          {hiddenFields
            ? Object.entries(hiddenFields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))
            : null}
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">{title}</AlertDialogTitle>
            {description ? (
              <AlertDialogDescription>{description}</AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel type="button">{cancelLabel}</AlertDialogCancel>
            <ConfirmAction destructive={destructive} label={confirmLabel} />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The confirm action button — submits the form and reflects pending state. */
function ConfirmAction({
  destructive,
  label,
}: {
  destructive: boolean;
  label: string;
}) {
  const { pending } = useFormStatus();
  return (
    <AlertDialogAction
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={cn(
        destructive &&
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30",
      )}
      // Keep the dialog open while the action runs; Radix would otherwise close
      // on click before the submit resolves.
      onClick={(e) => {
        if (pending) e.preventDefault();
      }}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {label}
    </AlertDialogAction>
  );
}
