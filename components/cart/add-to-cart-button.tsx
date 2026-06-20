"use client";

import { ShoppingBag, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deriveInventoryState, isOrderable } from "@/lib/inventory";
import { useCart } from "@/components/cart/cart-provider";
import { useAnalytics } from "@/components/analytics/analytics-provider";
import { AnalyticsEventType } from "@prisma/client";
import type { AddToCartProduct } from "@/lib/cart/types";

export function AddToCartButton({
  product,
  quantity = 1,
  personalizationNote,
  giftMessage,
  className,
  size = "default",
  label = "Add to cart",
}: {
  product: AddToCartProduct;
  quantity?: number;
  personalizationNote?: string;
  giftMessage?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
  label?: string;
}) {
  const { addItem, openCart } = useCart();
  const { track } = useAnalytics();
  const [justAdded, setJustAdded] = useState(false);

  const state = deriveInventoryState(product);
  const orderable = isOrderable(state);

  function handleAdd() {
    if (!orderable) return;
    addItem({ product, quantity, personalizationNote, giftMessage });
    // Funnel: add_to_cart with the product ref + unit price in paise (PII-free).
    track(AnalyticsEventType.add_to_cart, {
      productId: product.id,
      value: product.price,
    });
    setJustAdded(true);
    toast.success(`${product.title} added to cart`, {
      action: { label: "View cart", onClick: openCart },
    });
    window.setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <Button
      type="button"
      size={size}
      onClick={handleAdd}
      disabled={!orderable}
      className={cn(
        "rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all",
        className,
      )}
      aria-label={orderable ? label : "Out of stock"}
    >
      {justAdded ? (
        <Check className="size-4" />
      ) : (
        <ShoppingBag className="size-4" />
      )}
      {!orderable ? "Out of stock" : justAdded ? "Added!" : label}
    </Button>
  );
}
