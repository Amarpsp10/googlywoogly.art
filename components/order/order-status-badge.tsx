import { cn } from "@/lib/utils";
import { ORDER_STATUS, PAYMENT_STATUS, type Tone } from "@/lib/constants";
import type { OrderStatus, PaymentStatus } from "@prisma/client";

/**
 * Pastel status pill for the buyer-facing order pages. Maps the semantic `Tone`
 * from `lib/constants` onto the existing theme tokens (identical mapping to
 * `InventoryBadge`) so colour semantics stay consistent app-wide (`12` FR-39).
 */

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-secondary/60 text-secondary-foreground",
  warning: "bg-accent/60 text-accent-foreground",
  danger: "bg-destructive/15 text-destructive",
  info: "bg-pastel-sky/50 text-foreground",
  neutral: "bg-muted text-muted-foreground",
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const meta = ORDER_STATUS[status];
  return <Pill tone={meta.tone} label={meta.label} className={className} />;
}

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  const meta = PAYMENT_STATUS[status];
  return <Pill tone={meta.tone} label={meta.label} className={className} />;
}

function Pill({
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
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {label}
    </span>
  );
}
