import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/constants";

/**
 * Semantic status pill for the admin. Maps the shared `Tone` onto the theme
 * tokens using the **same** mapping as the storefront `InventoryBadge` /
 * `OrderStatusBadge` so colour semantics stay consistent app-wide (doc 10 §4,
 * `12` FR-39). Color is never the only signal — the label text carries meaning.
 */

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-secondary/60 text-secondary-foreground",
  warning: "bg-accent/60 text-accent-foreground",
  danger: "bg-destructive/15 text-destructive",
  info: "bg-pastel-sky/50 text-foreground",
  neutral: "bg-muted text-muted-foreground",
};

export function StatusBadge({
  tone,
  label,
  className,
}: {
  tone: Tone;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {label}
    </span>
  );
}
