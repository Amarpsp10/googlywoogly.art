"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className={cn("inline-flex items-center rounded-full border border-border", className)}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        className="flex size-9 items-center justify-center rounded-l-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        aria-label="Decrease quantity"
      >
        <Minus className="size-4" />
      </button>
      <span className="min-w-8 text-center text-sm font-semibold" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        className="flex size-9 items-center justify-center rounded-r-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        aria-label="Increase quantity"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
