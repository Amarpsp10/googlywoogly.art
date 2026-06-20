"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { QuantityStepper } from "./quantity-stepper";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { purchasableQuantity } from "@/lib/inventory";
import type { AddToCartProduct } from "@/lib/cart/types";

const PERSONALIZATION_MAX = 100;

export function PdpBuyPanel({
  product,
  personalizationLabel,
  whatsappNumber,
  productUrl,
}: {
  product: AddToCartProduct;
  personalizationLabel?: string | null;
  whatsappNumber: string;
  productUrl: string;
}) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  const max = Math.max(1, purchasableQuantity(product, 99));
  const waLink = buildWhatsAppLink(
    whatsappNumber,
    `Hi! I'm interested in "${product.title}". ${productUrl}`,
  );

  return (
    <div className="space-y-4">
      {product.allowsPersonalization && (
        <div>
          <label htmlFor="personalization" className="mb-1.5 block text-sm font-medium">
            {personalizationLabel || "Personalization"}
          </label>
          <input
            id="personalization"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={PERSONALIZATION_MAX}
            placeholder="Add your personalization…"
            className="w-full rounded-xl border border-border bg-input/40 px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-ring"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {note.length}/{PERSONALIZATION_MAX}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper value={qty} onChange={setQty} max={max} />
        <AddToCartButton
          product={product}
          quantity={qty}
          personalizationNote={note.trim() || undefined}
          size="lg"
          className="flex-1"
        />
      </div>

      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-full border-2 border-[#25D366] py-3 font-medium text-[#128C7E] transition hover:bg-[#25D366]/10"
      >
        <MessageCircle className="size-5" />
        Ask about this on WhatsApp
      </a>
    </div>
  );
}
