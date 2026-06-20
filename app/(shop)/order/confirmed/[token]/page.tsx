import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  MessageCircle,
  PartyPopper,
  Sparkles,
  Truck,
} from "lucide-react";
import { getOrderByTrackingToken, type TrackingDTO } from "@/lib/services/orders";
import { getSiteSettings } from "@/lib/services/settings";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { formatPaise } from "@/lib/money";
import { publicEnv } from "@/lib/env";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/storefront/container";
import { Button } from "@/components/ui/button";
import { OrderItemsList } from "@/components/order/order-items-list";
import { OrderTotals } from "@/components/order/order-totals";
import { OrderNotFound } from "@/components/order/order-not-found";
import { TrackView } from "@/components/analytics/track-view";

// Token-gated, no-store, noindex (`08` FR-40 / `04` FR-7): never cached, never indexed.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export function generateMetadata(): Metadata {
  // No order details in metadata — the token must never reach an indexable surface.
  return buildMetadata({ title: "Order confirmed", path: "/order/confirmed", noindex: true });
}

/**
 * Build the buyer → founder WhatsApp handoff for the confirmation page
 * (`08` §4.5). We can't use `buildOrderPlacedMessage` here because the redacted
 * `TrackingDTO` omits `customerName` (PII); the message stays friendly with the
 * order number + line items + grand total, which is all the founder needs.
 */
function buildHandoffMessage(order: TrackingDTO, storeName: string): string {
  const lines = order.items.map((it) => {
    const note = it.personalizationNote?.trim()
      ? `  (${it.personalizationNote.trim()})`
      : it.madeToOrder
        ? "  (made to order)"
        : "";
    return `• ${it.productTitle} × ${it.quantity} — ${formatPaise(it.lineTotal)}${note}`;
  });
  return [
    `Hi ${storeName}! 👋 I just placed an order.`,
    "",
    `Order: ${order.orderNumber}`,
    "Items:",
    ...lines,
    `Total: ${formatPaise(order.grandTotal)}`,
    "",
    "Please confirm availability & share payment details. Thank you!",
  ].join("\n");
}

const NEXT_STEPS = [
  {
    icon: CheckCircle2,
    title: "We confirm availability",
    body: "We'll review your order and reach out on WhatsApp to confirm everything's ready.",
  },
  {
    icon: CreditCard,
    title: "You pay securely on WhatsApp",
    body: "No payment now — we'll share easy UPI / bank options once your order is confirmed.",
  },
  {
    icon: Truck,
    title: "We craft & ship",
    body: "We lovingly prepare your order and ship it across India. Track it anytime below.",
  },
] as const;

export default async function OrderConfirmedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [order, settings] = await Promise.all([
    getOrderByTrackingToken(token),
    getSiteSettings(),
  ]);

  const whatsappNumber = settings?.whatsappNumber || publicEnv.whatsappNumber;
  const storeName = settings?.storeName ?? "GooglyWoogly Art";

  // Generic not-found at HTTP 200 — no existence oracle, no 404 (`08` FR-40).
  if (!order) {
    return <OrderNotFound whatsappLink={buildWhatsAppLink(whatsappNumber, undefined)} />;
  }

  const trackHref = `/track/${token}`;
  const whatsappLink = buildWhatsAppLink(
    whatsappNumber,
    buildHandoffMessage(order, storeName),
  );

  return (
    <Container as="main" className="py-12 md:py-16">
      {/* Funnel-head companion (fires once on mount); revenue is also written
          server-side by `placeOrder` (docs/13 FR-17) — this is not the source
          of truth for money. */}
      <TrackView type="place_order" value={order.grandTotal} />
      <div className="mx-auto max-w-2xl">
        {/* Celebration header */}
        <div className="text-center">
          <span className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full bg-pastel-pink/40 text-primary">
            <PartyPopper className="size-9" aria-hidden />
          </span>
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/50 px-4 py-1.5 text-sm font-medium text-foreground">
            <Sparkles className="size-4" aria-hidden />
            Order placed
          </span>
          <h1 className="font-serif text-3xl font-bold text-balance md:text-4xl">
            Thank you! Your order is in.
          </h1>
          <p className="mt-3 text-lg text-muted-foreground text-pretty">
            We&apos;re so grateful you chose something handmade. Here are your details.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm">
            <span className="text-muted-foreground">Order number</span>
            <span className="font-semibold text-foreground">{order.orderNumber}</span>
          </p>
        </div>

        {/* Primary actions — WhatsApp is the single most important CTA (payment happens there). */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {whatsappLink && (
            <Button
              asChild
              size="lg"
              className="rounded-full bg-[#25D366] text-white hover:bg-[#1ebe5d]"
            >
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-5" aria-hidden />
                Continue on WhatsApp
              </a>
            </Button>
          )}
          <Button asChild variant="outline" size="lg" className="rounded-full">
            <Link href={trackHref}>
              Track your order
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>

        {/* What happens next (`08` §4.4) */}
        <section aria-labelledby="next-steps-heading" className="mt-12">
          <h2
            id="next-steps-heading"
            className="font-serif text-xl font-bold text-foreground"
          >
            What happens next
          </h2>
          <ol className="mt-5 space-y-4">
            {NEXT_STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex gap-4 rounded-2xl border border-border bg-card p-4"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pastel-mint/40 text-foreground">
                  <step.icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    <span className="text-muted-foreground">{i + 1}. </span>
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Order summary */}
        <section aria-labelledby="summary-heading" className="mt-10">
          <h2 id="summary-heading" className="font-serif text-xl font-bold text-foreground">
            Order summary
          </h2>
          <div className="mt-4 rounded-2xl border border-border bg-card p-5 md:p-6">
            <OrderItemsList items={order.items} />
            <div className="mt-5 border-t border-border pt-5">
              <OrderTotals totals={order} />
            </div>
            <p className="mt-4 rounded-xl bg-secondary/30 px-3 py-2 text-center text-sm text-foreground">
              No payment now — we&apos;ll confirm your order and share easy payment options on
              WhatsApp.
            </p>
          </div>
        </section>

        {/* Save-this-link reassurance (`08` §4.4) */}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Sparkles className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
          Save this page to track your order anytime:{" "}
          <Link href={trackHref} className="font-medium text-primary hover:underline">
            track your order
          </Link>
          .
        </p>
      </div>
    </Container>
  );
}
