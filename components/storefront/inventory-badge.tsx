import { cn } from "@/lib/utils";
import { INVENTORY_STATE, type Tone } from "@/lib/constants";
import type { InventoryState } from "@/lib/inventory";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-secondary/60 text-secondary-foreground",
  warning: "bg-accent/60 text-accent-foreground",
  danger: "bg-destructive/15 text-destructive",
  info: "bg-pastel-sky/50 text-foreground",
  neutral: "bg-muted text-muted-foreground",
};

/** Small pill showing the derived inventory state, e.g. "Made to order". */
export function InventoryBadge({
  state,
  leadTimeDays,
  className,
}: {
  state: InventoryState;
  leadTimeDays?: number | null;
  className?: string;
}) {
  const meta = INVENTORY_STATE[state];
  const label =
    state === "made_to_order" && leadTimeDays
      ? `Made to order · ~${leadTimeDays} days`
      : meta.label;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        TONE_CLASS[meta.tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}
