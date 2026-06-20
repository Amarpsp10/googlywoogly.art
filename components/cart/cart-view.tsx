"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { QuantityStepper } from "@/components/storefront/quantity-stepper";
import { EmptyState } from "@/components/storefront/empty-state";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/money";
import { computeCartTotals } from "@/lib/services/pricing";
import type { ShippingDefaults } from "@/types";

export function CartView({ shippingDefaults }: { shippingDefaults: ShippingDefaults }) {
  const { items, updateQuantity, removeItem, hydrated, subtotalPaise } = useCart();

  if (!hydrated) {
    return <div className="py-16 text-center text-muted-foreground">Loading your cart…</div>;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-7" />}
        title="Your cart is empty"
        message="Find something handmade to love."
        action={
          <Button asChild className="rounded-full">
            <Link href="/products">Start shopping</Link>
          </Button>
        }
      />
    );
  }

  const totals = computeCartTotals(
    items.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
    shippingDefaults,
  );
  const freeShipRemaining = Math.max(
    0,
    shippingDefaults.freeShippingThresholdPaise - subtotalPaise,
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <ul className="divide-y divide-border">
        {items.map((line) => (
          <li key={line.lineId} className="flex gap-4 py-5">
            <Link
              href={`/products/${line.slug}`}
              className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-muted"
            >
              {line.imageUrl && (
                <Image src={line.imageUrl} alt={line.title} fill sizes="96px" className="object-cover" />
              )}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/products/${line.slug}`} className="font-semibold hover:text-primary">
                {line.title}
              </Link>
              {line.personalizationNote && (
                <p className="mt-0.5 text-sm text-muted-foreground">“{line.personalizationNote}”</p>
              )}
              {line.madeToOrder && (
                <p className="mt-0.5 text-xs text-muted-foreground">Made to order</p>
              )}
              <div className="mt-auto flex items-center justify-between pt-3">
                <QuantityStepper
                  value={line.quantity}
                  onChange={(q) => updateQuantity(line.lineId, q)}
                  max={line.maxQuantity ?? 99}
                />
                <div className="flex items-center gap-4">
                  <span className="font-bold text-primary">
                    {formatPaise(line.unitPrice * line.quantity)}
                  </span>
                  <button
                    onClick={() => removeItem(line.lineId)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${line.title}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="h-fit rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-24">
        <h2 className="font-serif text-xl font-bold">Order Summary</h2>
        {freeShipRemaining > 0 && (
          <p className="mt-3 rounded-xl bg-secondary/30 px-3 py-2 text-sm">
            Add <strong>{formatPaise(freeShipRemaining)}</strong> more for free shipping 🎉
          </p>
        )}
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="font-medium">{formatPaise(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Shipping</dt>
            <dd className="font-medium">
              {totals.shippingFee === 0 ? "Free" : formatPaise(totals.shippingFee)}
            </dd>
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-3 text-base font-bold">
            <dt>Total</dt>
            <dd className="text-primary">{formatPaise(totals.grandTotal)}</dd>
          </div>
        </dl>
        <Button asChild size="lg" className="mt-5 w-full rounded-full">
          <Link href="/checkout">Proceed to checkout</Link>
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          No payment now — we&apos;ll confirm your order and share easy payment options on WhatsApp.
        </p>
        <Link
          href="/products"
          className="mt-4 block text-center text-sm text-primary hover:underline"
        >
          Continue shopping
        </Link>
      </aside>
    </div>
  );
}
