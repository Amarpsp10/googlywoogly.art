"use client";

import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { cn } from "@/lib/utils";

export function CartButton({ className }: { className?: string }) {
  const { count, openCart, hydrated } = useCart();
  return (
    <button
      type="button"
      onClick={openCart}
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-pastel-pink/30",
        className,
      )}
      aria-label={`Open cart${hydrated && count > 0 ? `, ${count} item${count > 1 ? "s" : ""}` : ""}`}
    >
      <ShoppingBag className="size-5" />
      {hydrated && count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
