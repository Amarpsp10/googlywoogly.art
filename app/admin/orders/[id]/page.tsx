import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Gift, Mail, Package, Phone, User } from "lucide-react";
import type { OrderStatus } from "@prisma/client";

import { requireAdmin } from "@/lib/auth";
import { adminGetOrderById } from "@/lib/services/orders";
import { getSiteSettings } from "@/lib/services/settings";
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  ALLOWED_ORDER_TRANSITIONS,
} from "@/lib/constants";
import { formatPaise } from "@/lib/money";
import { formatDateTimeIST } from "@/lib/format";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { publicEnv } from "@/lib/env";
import type { Address } from "@/types";
import { cn } from "@/lib/utils";

import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { StatusBadge } from "@/components/admin/status-badge";

import { OrderStatusControl } from "./order-status-control";
import { OrderPaymentControl } from "./order-payment-control";
import { OrderInternalNotes } from "./order-internal-notes";
import { OrderTimeline } from "./order-timeline";
import { WhatsAppLink } from "./whatsapp-link";
import { CopyButton } from "./copy-button";

/**
 * Order detail (`/admin/orders/[id]`, docs/12 §3.6/§4.2). SSR, `noindex`,
 * auth-gated. Single-screen command center: customer block, line items (with
 * personalization + gift notes + MTO snapshot), addresses, money totals, the
 * **two independent control axes** (fulfillment status + payment status), the
 * append-only `OrderStatusEvent` timeline, internal notes, and a ship panel.
 *
 * Reads the full order via `adminGetOrderById` (admin-only data; no `costPrice`
 * lives on orders). `[id]` is the internal CUID.
 */

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Narrow a JSONB address column to the documented `Address` shape (or null). */
function toAddress(value: unknown): Address | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const a = value as Partial<Address>;
  if (
    typeof a.fullName !== "string" ||
    typeof a.line1 !== "string" ||
    typeof a.city !== "string" ||
    typeof a.state !== "string" ||
    typeof a.pincode !== "string"
  ) {
    return null;
  }
  return value as Address;
}

/** Render an `Address` as multi-line text for display/copy. */
function formatAddressLines(a: Address): string[] {
  const lines = [a.fullName, a.line1];
  if (a.line2) lines.push(a.line2);
  if (a.landmark) lines.push(`Near ${a.landmark}`);
  lines.push(`${a.city}, ${a.state} ${a.pincode}`);
  if (a.phone) lines.push(`Phone: ${a.phone}`);
  return lines;
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [order, settings] = await Promise.all([
    adminGetOrderById(id),
    getSiteSettings().catch(() => null),
  ]);

  if (!order) notFound();

  const statusMeta = ORDER_STATUS[order.status];
  const paymentMeta = PAYMENT_STATUS[order.paymentStatus];
  const shippingAddress = toAddress(order.shippingAddress);
  const billingAddress = toAddress(order.billingAddress);

  // Legal next fulfillment states from the current status (CANON §7, docs/12 FR-3).
  const legalTargets: OrderStatus[] = ALLOWED_ORDER_TRANSITIONS[order.status] ?? [];

  // Founder → buyer chat link (buyer's own number), to nudge/answer questions.
  const storeName = settings?.storeName ?? "GooglyWoogly Art";
  const trackUrl = `${publicEnv.siteUrl.replace(/\/$/, "")}/track/${order.trackingToken}`;
  const customerWhatsApp = order.customerPhone
    ? buildWhatsAppLink(
        order.customerPhone,
        `Hi ${order.customerName.split(/\s+/)[0] || "there"}! 👋 This is ${storeName} about your order ${order.orderNumber}.`,
      )
    : "";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to orders
        </Link>
        <AdminPageHeader
          title={`Order ${order.orderNumber}`}
          description={`Placed ${formatDateTimeIST(order.createdAt)} IST`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={statusMeta.tone} label={statusMeta.label} />
              <StatusBadge tone={paymentMeta.tone} label={paymentMeta.label} />
            </div>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column: order content ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Customer */}
          <Panel title="Customer">
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <User className="size-4 text-muted-foreground" aria-hidden />
                {order.customerName}
              </p>
              <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <Phone className="size-4" aria-hidden />
                <span className="text-foreground">{order.customerPhone}</span>
                {customerWhatsApp ? (
                  <WhatsAppLink href={customerWhatsApp}>Message on WhatsApp</WhatsAppLink>
                ) : null}
              </p>
              <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <Mail className="size-4" aria-hidden />
                <a
                  href={`mailto:${order.customerEmail}`}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  {order.customerEmail}
                </a>
              </p>
              {order.customer ? (
                <p className="pt-1 text-muted-foreground">
                  {order.customer.ordersCount}{" "}
                  {order.customer.ordersCount === 1 ? "order" : "orders"} ·{" "}
                  <Link
                    href="/admin/customers"
                    className="underline-offset-4 hover:underline"
                  >
                    View customer
                  </Link>
                </p>
              ) : null}
            </div>
          </Panel>

          {/* Items */}
          <Panel title="Items">
            {order.giftMessage ? (
              <div className="mb-4 flex items-start gap-2 rounded-xl bg-pastel-pink/20 px-3 py-2.5 text-sm">
                <Gift className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="font-medium">Order gift message:</span>{" "}
                  {order.giftMessage}
                </span>
              </div>
            ) : null}
            <ul className="divide-y divide-border">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="size-14 shrink-0 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                      <Package className="size-5" aria-hidden />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{item.productTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          SKU {item.sku} · {formatPaise(item.unitPrice)} × {item.quantity}
                        </p>
                      </div>
                      <p className="shrink-0 font-medium tabular-nums">
                        {formatPaise(item.lineTotal)}
                      </p>
                    </div>
                    {item.madeToOrderSnapshot ? (
                      <p className="inline-flex items-center gap-1 rounded-full bg-pastel-sky/40 px-2 py-0.5 text-xs text-foreground">
                        Made to order
                        {item.productionLeadTimeDaysSnapshot
                          ? ` · ${item.productionLeadTimeDaysSnapshot}d lead`
                          : ""}
                      </p>
                    ) : null}
                    {item.personalizationNote ? (
                      <p className="rounded-lg bg-muted px-2.5 py-1.5 text-xs">
                        <span className="font-medium">Personalization:</span>{" "}
                        {item.personalizationNote}
                      </p>
                    ) : null}
                    {item.giftMessage ? (
                      <p className="rounded-lg bg-pastel-pink/20 px-2.5 py-1.5 text-xs">
                        <span className="font-medium">Gift message:</span> {item.giftMessage}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          {/* Addresses */}
          <div className="grid gap-6 sm:grid-cols-2">
            <Panel
              title="Shipping address"
              action={
                shippingAddress ? (
                  <CopyButton
                    value={formatAddressLines(shippingAddress).join("\n")}
                    label="Copy address"
                  />
                ) : undefined
              }
            >
              {shippingAddress ? (
                <address className="text-sm not-italic leading-relaxed text-foreground">
                  {formatAddressLines(shippingAddress).map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              ) : (
                <p className="text-sm text-muted-foreground">No shipping address.</p>
              )}
            </Panel>

            <Panel title="Billing address">
              {billingAddress ? (
                <address className="text-sm not-italic leading-relaxed text-foreground">
                  {formatAddressLines(billingAddress).map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              ) : (
                <p className="text-sm text-muted-foreground">Same as shipping.</p>
              )}
            </Panel>
          </div>

          {/* Totals */}
          <Panel title="Totals">
            <dl className="space-y-1.5 text-sm">
              <Row label="Subtotal" value={formatPaise(order.subtotal)} />
              <Row label="Shipping" value={formatPaise(order.shippingFee)} />
              {order.discountTotal > 0 ? (
                <Row label="Discount" value={`− ${formatPaise(order.discountTotal)}`} />
              ) : null}
              <Row label="GST" value={formatPaise(order.taxTotal)} />
              <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Grand total</dt>
                <dd className="tabular-nums">{formatPaise(order.grandTotal)}</dd>
              </div>
              {order.amountPaid > 0 ? (
                <Row
                  label="Amount paid"
                  value={formatPaise(order.amountPaid)}
                  muted
                />
              ) : null}
            </dl>
            {order.customerNote ? (
              <div className="mt-4 rounded-xl bg-muted px-3 py-2.5 text-sm">
                <span className="font-medium">Customer note:</span> {order.customerNote}
              </div>
            ) : null}
          </Panel>

          {/* Timeline */}
          <Panel title="Timeline" description="Status history (newest first)">
            <OrderTimeline
              events={order.statusEvents.map((e) => ({
                id: e.id,
                status: e.status,
                note: e.note,
                createdAt: e.createdAt.toISOString(),
                actorName: e.changedBy?.name ?? null,
                channelNotified: e.channelNotified,
                customerNotified: e.customerNotified,
              }))}
            />
          </Panel>
        </div>

        {/* ── Right column: action rail ── */}
        <div className="space-y-6">
          <Panel title="Fulfillment status">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Current</span>
                <StatusBadge tone={statusMeta.tone} label={statusMeta.label} />
              </div>
              <OrderStatusControl
                orderId={order.id}
                currentStatus={order.status}
                legalTargets={legalTargets}
              />
            </div>
          </Panel>

          <Panel title="Payment">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Current</span>
                <StatusBadge tone={paymentMeta.tone} label={paymentMeta.label} />
              </div>
              <OrderPaymentControl
                orderId={order.id}
                currentPaymentStatus={order.paymentStatus}
              />
            </div>
          </Panel>

          {/* Shipping capture (shown once the order can ship or has shipped) */}
          {(legalTargets.includes("shipped") || order.courierName) ? (
            <Panel title="Shipping">
              {order.courierName ? (
                <dl className="space-y-1.5 text-sm">
                  <Row label="Courier" value={order.courierName} />
                  {order.trackingNumber ? (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted-foreground">Tracking</dt>
                      <dd className="flex items-center gap-1.5">
                        <span className="tabular-nums">{order.trackingNumber}</span>
                        <CopyButton value={order.trackingNumber} label="Copy" iconOnly />
                      </dd>
                    </div>
                  ) : null}
                  {order.trackingUrl ? (
                    <div className="pt-1">
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        Track with courier ↗
                      </a>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Capture courier and tracking when you mark this order shipped.
                </p>
              )}
            </Panel>
          ) : null}

          {/* Internal notes */}
          <Panel
            title="Internal notes"
            description="Private — never shown to the customer."
          >
            <OrderInternalNotes
              orderId={order.id}
              initialNotes={order.internalNotes ?? ""}
            />
          </Panel>

          {/* Tracking link for reference */}
          <Panel title="Customer tracking">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-muted-foreground">{trackUrl}</span>
              <CopyButton value={trackUrl} label="Copy" iconOnly />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** A label/value row for the totals + shipping definition lists. */
function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", muted && "text-muted-foreground")}>{value}</dd>
    </div>
  );
}
