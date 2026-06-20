import { cn } from "@/lib/utils";
import { formatPaise } from "@/lib/money";
import type { TrackingDTO } from "@/lib/services/orders";

/**
 * Money breakdown (paise) shared by the confirmation + tracking pages. Shipping
 * renders as "Free" when zero; discount/tax rows hide when zero so the MVP
 * (taxTotal = 0, no coupon) reads cleanly.
 */
export function OrderTotals({
  totals,
  className,
}: {
  totals: Pick<
    TrackingDTO,
    "subtotal" | "shippingFee" | "discountTotal" | "taxTotal" | "grandTotal"
  >;
  className?: string;
}) {
  return (
    <dl className={cn("space-y-2 text-sm", className)}>
      <Row label="Subtotal" value={formatPaise(totals.subtotal)} />
      <Row
        label="Shipping"
        value={totals.shippingFee === 0 ? "Free" : formatPaise(totals.shippingFee)}
      />
      {totals.discountTotal > 0 && (
        <Row label="Discount" value={`− ${formatPaise(totals.discountTotal)}`} />
      )}
      {totals.taxTotal > 0 && <Row label="Tax" value={formatPaise(totals.taxTotal)} />}
      <div className="mt-2 flex items-baseline justify-between border-t border-border pt-3 text-base font-bold">
        <dt>Total</dt>
        <dd className="text-primary">{formatPaise(totals.grandTotal)}</dd>
      </div>
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
