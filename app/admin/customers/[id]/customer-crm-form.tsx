"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";
import { updateCustomerCrm } from "../actions";
import type { ActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";
import { FormField, AdminTextarea } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";

/**
 * Customer CRM form (client leaf): a tag editor (add/remove chips) + free-text
 * notes. Tags are serialised into a hidden comma-separated field the
 * `updateCustomerCrm` action re-validates/normalises server-side. Posts via
 * `useActionState`; surfaces the `ActionResult` as a toast.
 */

const initial: ActionResult<void> = { ok: false, error: "" };
const MAX_TAGS = 20;

export function CustomerCrmForm({
  id,
  tags: initialTags,
  notes,
}: {
  id: string;
  tags: string[];
  notes: string | null;
}) {
  const [state, action] = useActionState(updateCustomerCrm, initial);
  const [tags, setTags] = React.useState<string[]>(initialTags);
  const [draft, setDraft] = React.useState("");
  const fieldErrors = !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state.ok) toast.success("Customer saved.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  const addTag = React.useCallback(
    (raw: string) => {
      const value = raw.trim().slice(0, 32);
      if (!value) return;
      setTags((prev) => {
        if (prev.length >= MAX_TAGS) return prev;
        if (prev.some((t) => t.toLowerCase() === value.toLowerCase())) return prev;
        return [...prev, value];
      });
      setDraft("");
    },
    [],
  );

  const removeTag = React.useCallback((value: string) => {
    setTags((prev) => prev.filter((t) => t !== value));
  }, []);

  const onDraftKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      {/* Serialised tag list — re-validated/normalised server-side. */}
      <input type="hidden" name="tags" value={tags.join(",")} />

      <FormField
        label="Tags"
        hint="Press Enter or comma to add. e.g. VIP, repeat, corporate."
        error={fieldErrors?.tags?.[0]}
      >
        <div
          className={cn(
            "flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-background px-2 py-1.5",
            "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
          )}
        >
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-pastel-pink/40 py-0.5 pl-2.5 pr-1 text-xs font-medium text-foreground"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
                className="flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onDraftKeyDown}
            onBlur={() => addTag(draft)}
            disabled={tags.length >= MAX_TAGS}
            placeholder={tags.length === 0 ? "Add a tag…" : ""}
            aria-label="Add a tag"
            className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
        </div>
      </FormField>

      <FormField
        label="Notes"
        hint="Private — preferences, conversations, anything useful."
        error={fieldErrors?.notes?.[0]}
      >
        <AdminTextarea
          name="notes"
          defaultValue={notes ?? ""}
          rows={5}
          placeholder="e.g. Prefers WhatsApp. Ordered for Diwali gifting last year."
        />
      </FormField>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => addTag(draft)}
          disabled={!draft.trim() || tags.length >= MAX_TAGS}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          <Plus className="size-3.5" />
          Add tag
        </button>
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}
