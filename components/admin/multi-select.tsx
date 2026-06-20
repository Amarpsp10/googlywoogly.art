"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Render the option disabled (e.g. automated collections — docs/11 FR-31). */
  disabled?: boolean;
  /** Small trailing hint shown after the label (e.g. "auto by rules"). */
  hint?: string;
}

/**
 * `MultiSelect` — a compact, keyboard-accessible checkbox list for many-to-many
 * pickers (collections, occasions) on the product form. Each option is a real
 * checkbox so it posts/toggles accessibly without a popover; disabled options
 * (automated collections) can't be toggled (docs/11 FR-31 / ST-20). Controlled.
 */
export function MultiSelect({
  options,
  value,
  onChange,
  emptyText = "Nothing to choose yet.",
  ariaLabel,
}: {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  emptyText?: string;
  ariaLabel?: string;
}) {
  const selected = React.useMemo(() => new Set(value), [value]);

  const toggle = (val: string) => {
    const next = new Set(selected);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onChange([...next]);
  };

  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul
      className="max-h-56 space-y-0.5 overflow-y-auto rounded-xl border border-input bg-background p-1"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const isChecked = selected.has(opt.value);
        return (
          <li key={opt.value}>
            <button
              type="button"
              role="checkbox"
              aria-checked={isChecked}
              disabled={opt.disabled}
              onClick={() => !opt.disabled && toggle(opt.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                opt.disabled && "cursor-not-allowed opacity-60 hover:bg-transparent",
              )}
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded border",
                  isChecked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background",
                )}
                aria-hidden
              >
                {isChecked ? <Check className="size-3" /> : null}
              </span>
              <span className="min-w-0 flex-1 truncate">{opt.label}</span>
              {opt.hint ? (
                <span className="shrink-0 text-xs text-muted-foreground">{opt.hint}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
