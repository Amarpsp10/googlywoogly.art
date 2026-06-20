import type { Metadata } from "next";
import type { OrderStatus } from "@prisma/client";
import { ExternalLink, MapPin, MessageCircle, Package, Truck } from "lucide-react";
import { getOrderByTrackingToken } from "@/lib/services/orders";
import { getSiteSettings } from "@/lib/services/settings";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { publicEnv } from "@/lib/env";
import { formatDateTimeIST } from "@/lib/format";
import { buildMetadata } from "@/lib/seo/metadata";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants";
import { Container } from "@/components/storefront/container";
import { Button } from "@/components/ui/button";
import { OrderTimeline } from "@/components/order/order-timeline";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order/order-status-badge";
import { OrderItemsList } from "@/components/order/order-items-list";
import { OrderTotals } from "@/components/order/order-totals";
import { OrderNotFound } from "@/components/order/order-not-found";
import { CopyTrackingNumber } from "@/components/order/copy-tracking-number";

// Token-gated, no-store, noindex (`12` FR-32 / `04` FR-7). The token is the sole
// bearer credential — it must never be cached or reach an indexable surface.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export function generateMetadata(): Metadata {
  return buildMetadata({ title: "Track your order", path: "/track", noindex: true });
}

/** Buyer-friendly one-line description per fulfillment stage (`12` FR-36). */
function statusDescription(status: OrderStatus, courierName: string | null): string {
  switch (status) {
    case "pending_confirmation":
      return "We've received your order and will confirm availability on WhatsApp shortly.";
    case "confirmed":
      return "Your order is confirmed. We'll begin preparing it soon.";
    case "in_production":
      return "Your order is being lovingly handcrafted.";
    case "ready_to_ship":
      return "Your order is packed and ready to be dispatched.";
    case "shipped":
      return courierName
        ? `On its way via ${courierName}.`
        : "Your order is on its way.";
    case "delivered":
      return "Delivered! We hope you love it. 💕";
    case "cancelled":
      return "This order was cancelled. Reach out on WhatsApp if you have any questions.";
    case "on_hold":
      return "Your order is on hold. We'll be in touch on WhatsApp.";
    default:
      return "";
  }
}

export default async function TrackOrderPage({
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

  // Generic not-found at HTTP 200 — no existence oracle, no 404 (`12` FR-32).
  if (!order) {
    return <OrderNotFound whatsappLink={buildWhatsAppLink(whatsappNumber, undefined)} />;
  }

  const statusMeta = ORDER_STATUS[order.status];
  const paymentMeta = PAYMENT_STATUS[order.paymentStatus];
  const isShipped =
    order.status === "shipped" || order.status === "delivered";

  const whatsappLink = buildWhatsAppLink(
    whatsappNumber,
    `Hi ${storeName}! 👋 I'd like to check on my order ${order.orderNumber}. Could you help?`,
  );

  return (
    <Container as="main" className="py-12 md:py-16">
      <div className="mx-auto max-w-3xl">
        {/* Header + current status */}
        <header>
          <p className="text-sm text-muted-foreground">Order tracking</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-serif text-3xl font-bold text-foreground md:text-4xl">
              {order.orderNumber}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.paymentStatus} />
            </div>
          </div>
          <p className="mt-3 text-muted-foreground text-pretty">
            {statusDescription(order.status, order.courierName)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed on{" "}
            <time dateTime={order.createdAt.toISOString()}>
              {formatDateTimeIST(order.createdAt)}
            </time>
          </p>
          <p className="sr-only" aria-live="polite">
            Current status: {statusMeta.label}. Payment: {paymentMeta.label}.
          </p>
        </header>

        {/* Shipment / courier card — only once dispatched */}
        {isShipped && order.trackingNumber && (
          <section
            aria-labelledby="shipment-heading"
            className="mt-8 rounded-2xl border border-border bg-pastel-sky/20 p-5"
          >
            <h2
              id="shipment-heading"
              className="flex items-center gap-2 font-serif text-lg font-bold text-foreground"
            >
              <Truck className="size-5 text-primary" aria-hidden />
              Shipment details
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              {order.courierName && (
                <div className="flex flex-wrap items-center gap-x-2">
                  <dt className="text-muted-foreground">Courier</dt>
                  <dd className="font-medium text-foreground">{order.courierName}</dd>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <dt className="text-muted-foreground">Tracking number</dt>
                <dd className="font-medium text-foreground">{order.trackingNumber}</dd>
                <CopyTrackingNumber value={order.trackingNumber} />
              </div>
            </dl>
            {order.trackingUrl && (
              <Button asChild className="mt-4 rounded-full" size="sm">
                <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                  Track with courier
                  <ExternalLink className="size-4" aria-hidden />
                </a>
              </Button>
            )}
          </section>
        )}

        {/* Timeline */}
        <section aria-labelledby="timeline-heading" className="mt-10">
          <h2
            id="timeline-heading"
            className="font-serif text-xl font-bold text-foreground"
          >
            Progress
          </h2>
          {order.statusEvents.length > 0 ? (
            <div className="mt-5 rounded-2xl border border-border bg-card p-5 md:p-6">
              <OrderTimeline events={order.statusEvents} />
            </div>
          ) : (
            <p className="mt-3 text-muted-foreground">
              We&apos;ll post updates here as your order moves along.
            </p>
          )}
        </section>

        {/* Items + coarse delivery location + totals */}
        <section aria-labelledby="items-heading" className="mt-10">
          <h2 id="items-heading" className="font-serif text-xl font-bold text-foreground">
            Your items
          </h2>
          <div className="mt-4 rounded-2xl border border-border bg-card p-5 md:p-6">
            <OrderItemsList items={order.items} />
            <div className="mt-5 border-t border-border pt-5">
              <OrderTotals totals={order} />
            </div>
          </div>

          {order.shippingArea && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4 shrink-0" aria-hidden />
              Delivering to {order.shippingArea.city}, {order.shippingArea.state}{" "}
              {order.shippingArea.pincode}
            </p>
          )}
        </section>

        {/* Help CTA */}
        <section className="mt-12 rounded-2xl border border-border bg-pastel-pink/15 p-6 text-center">
          <Package className="mx-auto size-7 text-primary" aria-hidden />
          <h2 className="mt-2 font-serif text-lg font-bold text-foreground">
            Questions about your order?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;re here to help — payments and any questions are handled on WhatsApp.
          </p>
          {whatsappLink && (
            <Button
              asChild
              size="lg"
              className="mt-4 rounded-full bg-[#25D366] text-white hover:bg-[#1ebe5d]"
            >
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-5" aria-hidden />
                Chat with us on WhatsApp
              </a>
            </Button>
          )}
        </section>
      </div>
    </Container>
  );
}
