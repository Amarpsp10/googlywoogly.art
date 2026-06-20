"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/cart/cart-provider";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/money";

export function CartDrawer() {
  const { items, isOpen, closeCart, subtotalPaise, updateQuantity, removeItem } = useCart();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            aria-hidden
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-background shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            role="dialog"
            aria-label="Shopping cart"
          >
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-serif text-xl font-bold">Your Cart</h2>
              <button
                onClick={closeCart}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                aria-label="Close cart"
              >
                <X className="size-5" />
              </button>
            </header>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-pastel-pink/30">
                  <ShoppingBag className="size-7 text-primary" />
                </div>
                <p className="text-muted-foreground">Your cart is empty.</p>
                <Button asChild className="rounded-full" onClick={closeCart}>
                  <Link href="/products">Start shopping</Link>
                </Button>
              </div>
            ) : (
              <>
                <ul className="flex-1 divide-y divide-border overflow-y-auto px-5">
                  {items.map((line) => (
                    <li key={line.lineId} className="flex gap-3 py-4">
                      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                        {line.imageUrl && (
                          <Image
                            src={line.imageUrl}
                            alt={line.title}
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Link
                          href={`/products/${line.slug}`}
                          onClick={closeCart}
                          className="line-clamp-2 text-sm font-semibold hover:text-primary"
                        >
                          {line.title}
                        </Link>
                        {line.personalizationNote && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            “{line.personalizationNote}”
                          </p>
                        )}
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="inline-flex items-center rounded-full border border-border">
                            <button
                              className="px-2.5 py-1 text-muted-foreground hover:text-foreground"
                              onClick={() => updateQuantity(line.lineId, line.quantity - 1)}
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <span className="min-w-6 text-center text-sm font-medium">
                              {line.quantity}
                            </span>
                            <button
                              className="px-2.5 py-1 text-muted-foreground hover:text-foreground"
                              onClick={() => updateQuantity(line.lineId, line.quantity + 1)}
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-sm font-bold text-primary">
                            {formatPaise(line.unitPrice * line.quantity)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(line.lineId)}
                        className="self-start text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${line.title}`}
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>

                <footer className="space-y-3 border-t border-border px-5 py-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-bold">{formatPaise(subtotalPaise)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Shipping &amp; final total shown at checkout. Payment is arranged on WhatsApp after we confirm your order.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button asChild variant="outline" className="rounded-full" onClick={closeCart}>
                      <Link href="/cart">View cart</Link>
                    </Button>
                    <Button asChild className="rounded-full" onClick={closeCart}>
                      <Link href="/checkout">Checkout</Link>
                    </Button>
                  </div>
                </footer>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
