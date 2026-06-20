import { cn } from "@/lib/utils";
import { formatPaise, discountPercent } from "@/lib/money";

/** Price with optional strikethrough compare-at and a discount pill (theme: mint). */
export function PriceDisplay({
  price,
  compareAtPrice,
  className,
  size = "default",
}: {
  price: number;
  compareAtPrice?: number | null;
  className?: string;
  size?: "sm" | "default" | "lg";
}) {
  const pct = discountPercent(price, compareAtPrice);
  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span
        className={cn(
          "font-bold text-primary",
          size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg",
        )}
      >
        {formatPaise(price)}
      </span>
      {pct > 0 && (
        <>
          <span className="text-sm text-muted-foreground line-through">
            {formatPaise(compareAtPrice!)}
          </span>
          <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
            {pct}% OFF
          </span>
        </>
      )}
    </div>
  );
}
