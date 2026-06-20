"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * `TagInput` — type-and-enter chip input for `Product.tags` (docs/11 FR-32).
 * Values are lowercased, trimmed, de-duplicated. Backspace on an empty field
 * removes the last chip. An optional `suggestions` list powers a native
 * `<datalist>` autocomplete from existing catalog tags. Fully keyboard-operable.
 *
 * Controlled: pass `value` (string[]) and `onChange`.
 */
export function TagInput({
  value,
  onChange,
  id,
  placeholder = "Add a tag and press Enter",
  suggestions = [],
  lowercase = true,
  ariaDescribedby,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  id?: string;
  placeholder?: string;
  suggestions?: string[];
  /** Lowercase entries (tags) vs preserve casing (occasions). */
  lowercase?: boolean;
  ariaDescribedby?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const reactId = React.useId();
  const listId = `${id ?? reactId}-suggestions`;

  const commit = React.useCallback(
    (raw: string) => {
      const cleaned = lowercase ? raw.trim().toLowerCase() : raw.trim();
      if (!cleaned) return;
      if (value.includes(cleaned)) {
        setDraft("");
        return;
      }
      onChange([...value, cleaned]);
      setDraft("");
    },
    [value, onChange, lowercase],
  );

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  return (
    <div
      className={cn(
        "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-xl border border-input bg-background px-2 py-1.5 text-sm",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
        >
          {tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            aria-label={`Remove ${tag}`}
            className="rounded-full text-muted-foreground hover:text-destructive"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        list={suggestions.length ? listId : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            remove(value[value.length - 1]);
          }
        }}
        onBlur={() => commit(draft)}
        placeholder={value.length === 0 ? placeholder : ""}
        aria-describedby={ariaDescribedby}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 outline-none placeholder:text-muted-foreground"
      />
      {suggestions.length ? (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}
