"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { addInternalNote } from "../actions";
import { AdminTextarea } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";

/**
 * Admin-only internal notes editor (docs/12 FR-29). Save-on-blur (and an explicit
 * Save button) calls the typed `addInternalNote` Server Action via `useTransition`
 * — it only fires when the value actually changed, so blurs without edits are
 * free. Never customer-visible.
 */
export function OrderInternalNotes({
  orderId,
  initialNotes,
}: {
  orderId: string;
  initialNotes: string;
}) {
  const [value, setValue] = React.useState(initialNotes);
  const [saved, setSaved] = React.useState(initialNotes);
  const [pending, startTransition] = React.useTransition();

  const dirty = value !== saved;

  const save = React.useCallback(() => {
    if (value === saved) return;
    const next = value;
    startTransition(async () => {
      const result = await addInternalNote({ orderId, internalNotes: next });
      if (result.ok) {
        setSaved(next);
        toast.success("Notes saved.");
      } else {
        toast.error(result.error || "Could not save notes.");
      }
    });
  }, [orderId, value, saved]);

  return (
    <div className="space-y-2">
      <label htmlFor="order-internal-notes" className="sr-only">
        Internal notes
      </label>
      <AdminTextarea
        id="order-internal-notes"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        rows={4}
        maxLength={5000}
        placeholder="Context for fulfilment — e.g. deliver after Diwali…"
        disabled={pending}
      />
      <div className="flex items-center justify-end gap-2">
        {pending ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Saving…
          </span>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={save}
          disabled={pending || !dirty}
        >
          Save notes
        </Button>
      </div>
    </div>
  );
}
