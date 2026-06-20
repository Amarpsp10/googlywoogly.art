"use client";

import * as React from "react";
import { useActionState } from "react";
import { ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  type ContentFormState,
  EMPTY_FORM_STATE,
} from "./content-form-state";

/**
 * `ActionForm` — the shared client wrapper for content/settings editor `<form>`s.
 * Binds a `useActionState` Server Action, surfaces a success/error **toast** with
 * a "View live →" deep link (doc 15 FR-3), exposes per-field errors to children
 * via context, and (optionally) closes a parent sheet/dialog on success.
 *
 * Children read field errors with `useFieldError(name)` and render them in the
 * admin `FormField error=…` slot. The form posts native FormData, so the editor
 * fields are RSC-friendly controls — only this wrapper is a client leaf.
 */

type ServerAction = (
  state: ContentFormState,
  formData: FormData,
) => Promise<ContentFormState>;

interface ActionFormContextValue {
  fieldErrors?: Record<string, string[]>;
  pending: boolean;
}

const ActionFormContext = React.createContext<ActionFormContextValue>({ pending: false });

/** First server error for `name`, for the admin `FormField error` prop. */
export function useFieldError(name: string): string | undefined {
  const { fieldErrors } = React.useContext(ActionFormContext);
  return fieldErrors?.[name]?.[0];
}

/** Whether the enclosing ActionForm's action is currently running. */
export function useActionFormPending(): boolean {
  return React.useContext(ActionFormContext).pending;
}

export function ActionForm({
  action,
  children,
  className,
  /** Called once after a successful submit (e.g. close a sheet, reset). */
  onSuccess,
  /** Toast label on success; defaults to the server message. */
  successToast,
  ...props
}: {
  action: ServerAction;
  children: React.ReactNode;
  className?: string;
  onSuccess?: () => void;
  successToast?: string;
} & Omit<React.ComponentProps<"form">, "action">) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);

  // Fire toast + onSuccess when a new result arrives (keyed by `ts`).
  const lastTs = React.useRef<number | undefined>(undefined);
  React.useEffect(() => {
    if (state.ts === undefined || state.ts === lastTs.current) return;
    lastTs.current = state.ts;

    if (state.ok) {
      toast.success(successToast ?? state.message ?? "Saved.", {
        icon: <CheckCircle2 className="size-4" />,
        action: state.viewLive
          ? {
              label: "View live",
              onClick: () => window.open(state.viewLive, "_blank", "noopener"),
            }
          : undefined,
      });
      onSuccess?.();
    } else if (state.message) {
      toast.error(state.message, { icon: <AlertCircle className="size-4" /> });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ts]);

  return (
    <ActionFormContext.Provider value={{ fieldErrors: state.fieldErrors, pending }}>
      <form action={formAction} className={cn("space-y-4", className)} {...props}>
        {/* Non-field-level error banner (accessible). */}
        {state.ok === false && state.message ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{state.message}</span>
          </div>
        ) : null}

        {state.ok === true && state.viewLive ? (
          <a
            href={state.viewLive}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            View live <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}

        {children}
      </form>
    </ActionFormContext.Provider>
  );
}
