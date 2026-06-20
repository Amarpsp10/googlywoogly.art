import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only star rating (handmade reviews are V1; used by testimonials now). */
export function Rating({
  value,
  count,
  className,
}: {
  value: number;
  count?: number;
  className?: string;
}) {
  const full = Math.round(value);
  return (
    <div className={cn("flex items-center gap-1", className)} aria-label={`${value} out of 5`}>
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "size-4",
              i < full ? "fill-accent text-accent" : "fill-muted text-muted",
            )}
          />
        ))}
      </div>
      {count !== undefined && <span className="text-xs text-muted-foreground">({count})</span>}
    </div>
  );
}
