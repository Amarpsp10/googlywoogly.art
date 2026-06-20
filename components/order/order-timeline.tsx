import {
  CheckCircle2,
  Circle,
  Clock,
  PauseCircle,
  Truck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { OrderStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { ORDER_STATUS, type Tone } from "@/lib/constants";
import { formatDateTimeIST } from "@/lib/format";

/**
 * Buyer-facing order status timeline (`12` FR-30/FR-35). A semantic ordered
 * list — each `OrderStatusEvent` is a step with its friendly status label, the
 * IST timestamp, and the *public* note (e.g. "Shipped via Delhivery · AWB …").
 *
 * Intentionally PII-free: it renders only what `toTrackingDTO` already redacted
 * (no actor, no admin names, no internal notes). `[Payment]`-prefixed internal
 * notes are filtered out here so they never reach the buyer (FR-35).
 */

/** Minimal event shape this component renders (a subset of `TrackingStatusEvent`). */
export interface TimelineEvent {
  status: OrderStatus;
  note: string | null;
  createdAt: Date;
}

/** Map each status tone onto the existing pastel theme tokens (mirrors InventoryBadge). */
const TONE_CLASS: Record<Tone, string> = {
  success: "bg-secondary/60 text-secondary-foreground",
  warning: "bg-accent/60 text-accent-foreground",
  danger: "bg-destructive/15 text-destructive",
  info: "bg-pastel-sky/50 text-foreground",
  neutral: "bg-muted text-muted-foreground",
};

/** A small icon per status so the rail reads at a glance. */
const STATUS_ICON: Record<OrderStatus, LucideIcon> = {
  pending_confirmation: Clock,
  confirmed: CheckCircle2,
  in_production: Circle,
  ready_to_ship: Circle,
  shipped: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
  on_hold: PauseCircle,
};

/** True for internal payment notes that must never surface to the buyer (FR-35). */
function isInternalNote(note: string | null): boolean {
  return !!note && note.trimStart().startsWith("[Payment]");
}

export function OrderTimeline({
  events,
  className,
}: {
  events: TimelineEvent[];
  /** Optional override of container classes. */
  className?: string;
}) {
  // Chronological (oldest → newest) so the rail reads top-to-bottom like a journey;
  // the most recent step is highlighted as the current stage.
  const ordered = [...events].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const lastIndex = ordered.length - 1;

  if (ordered.length === 0) return null;

  return (
    <ol className={cn("space-y-0", className)}>
      {ordered.map((event, i) => {
        const meta = ORDER_STATUS[event.status];
        const Icon = STATUS_ICON[event.status] ?? Circle;
        const isCurrent = i === lastIndex;
        const isLast = i === lastIndex;
        const note = isInternalNote(event.note) ? null : event.note?.trim() || null;

        return (
          <li key={`${event.status}-${i}`} className="relative flex gap-4 pb-8 last:pb-0">
            {/* Connector rail between dots */}
            {!isLast && (
              <span
                aria-hidden
                className="absolute left-[18px] top-9 bottom-0 w-px bg-border"
              />
            )}

            {/* Status dot */}
            <span
              aria-hidden
              className={cn(
                "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full",
                TONE_CLASS[meta.tone],
                isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
            >
              <Icon className="size-4" />
            </span>

            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="font-semibold text-foreground">{meta.label}</p>
                {isCurrent && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Current
                  </span>
                )}
              </div>
              <time
                dateTime={event.createdAt.toISOString()}
                className="mt-0.5 block text-sm text-muted-foreground"
              >
                {formatDateTimeIST(event.createdAt)}
              </time>
              {note && <p className="mt-1.5 text-sm text-foreground/80">{note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
