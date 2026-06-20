"use client";

import * as React from "react";
import { FormField, AdminTextarea } from "@/components/admin/form-field";
import { useFieldError } from "./action-form";

/**
 * `RichTextField` — the MVP rich-text control (doc 15 OQ-2 ships a constrained
 * editor; for MVP a `Textarea` storing HTML/markdown is acceptable). It posts
 * raw HTML which the Server Action **sanitizes server-side** against the
 * allow-list before persisting (FR-28 — the client is never trusted).
 *
 * Provides a live character count and an allowed-tags hint so the founder knows
 * the supported formatting. Wired to the enclosing `ActionForm` for field errors.
 */
export function RichTextField({
  name,
  label,
  defaultValue = "",
  required,
  rows = 10,
  hint = "Basic HTML allowed: headings (h2/h3), bold, italic, lists, links, blockquote. Other tags are removed on save.",
  maxLength,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  rows?: number;
  hint?: string;
  maxLength?: number;
}) {
  const error = useFieldError(name);
  const [value, setValue] = React.useState(defaultValue);

  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      <AdminTextarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        onChange={(e) => setValue(e.target.value)}
        className="font-mono text-xs leading-relaxed"
        spellCheck
      />
      <p className="mt-1 text-right text-[11px] text-muted-foreground" aria-live="polite">
        {value.length}
        {maxLength ? ` / ${maxLength}` : ""} characters
      </p>
    </FormField>
  );
}
