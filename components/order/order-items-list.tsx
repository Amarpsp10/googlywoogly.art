import Image from "next/image";
import { Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPaise } from "@/lib/money";
import type { TrackingDTO } from "@/lib/services/orders";

/**
 * Read-only summary of the frozen order line snapshots, shared by the
 * confirmation and tracking pages. Renders only the redacted item fields from
 * `TrackingDTO` (title, sku, qty, unit/line price, personalization + gift note,
 * made-to-order flag) — no PII.
 */

type TrackingItem = TrackingDTO["items"][number];

export function OrderItemsList({
  items,
  className,
}: {
  items: TrackingItem[];
  className?: string;
}) {
  return (
    <ul className={cn("divide-y divide-border", className)}>
      {items.map((item, i) => (
        <li key={`${item.sku}-${i}`} className="flex gap-4 py-4 first:pt-0 last:pb-0">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={item.productTitle}
                width={80}
                height={80}
                sizes="80px"
                className="size-full object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center text-muted-foreground">
                <Gift className="size-6" aria-hidden />
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Frozen snapshot title. The redacted tracking DTO exposes only
                productId (no slug), so we don't deep-link to the PDP from here. */}
            <p className="font-semibold text-foreground">{item.productTitle}</p>

            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatPaise(item.unitPrice)} &times; {item.quantity}
              {item.madeToOrder && (
                <span className="ml-2 rounded-full bg-pastel-lavender/40 px-2 py-0.5 text-xs text-foreground">
                  Made to order
                  {item.productionLeadTimeDays
                    ? ` · ~${item.productionLeadTimeDays} days`
                    : ""}
                </span>
              )}
            </p>

            {item.personalizationNote && (
              <p className="mt-1 text-sm text-foreground/80">
                <span className="text-muted-foreground">Personalization: </span>
                &ldquo;{item.personalizationNote}&rdquo;
              </p>
            )}
            {item.giftMessage && (
              <p className="mt-1 inline-flex items-start gap-1.5 text-sm text-foreground/80">
                <Gift className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="text-muted-foreground">Gift note: </span>
                  &ldquo;{item.giftMessage}&rdquo;
                </span>
              </p>
            )}
          </div>

          <div className="shrink-0 text-right font-semibold text-foreground">
            {formatPaise(item.lineTotal)}
          </div>
        </li>
      ))}
    </ul>
  );
}
