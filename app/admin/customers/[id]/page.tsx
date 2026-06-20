import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle, Mail, Phone } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { adminGetCustomerById } from "@/lib/admin/crm";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants";
import { formatPaise } from "@/lib/money";
import { formatDateIST, formatDateTimeIST } from "@/lib/format";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { toWhatsAppDigits, toTelHref, formatPhoneDisplay } from "@/lib/admin/phone";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import {
  AdminTable,
  AdminTableHeader,
  AdminTableHead,
  AdminTableBody,
  AdminTableRow,
  AdminTableCell,
} from "@/components/admin/admin-table";
import { CustomerCrmForm } from "./customer-crm-form";

export const metadata: Metadata = { title: "Customer" };

/** A single stat tile in the customer summary. */
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;

  const customer = await adminGetCustomerById(admin.role, id);
  if (!customer) notFound();

  const whatsappHref = buildWhatsAppLink(toWhatsAppDigits(customer.phone));
  const telHref = toTelHref(customer.phone);
  const phoneDisplay = formatPhoneDisplay(customer.phone);
  const mailtoHref = customer.email ? `mailto:${customer.email}` : "";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to customers
        </Link>
        <AdminPageHeader
          title={customer.name}
          description={`Customer since ${formatDateIST(customer.createdAt)}`}
        />
      </div>

      <Panel title="Contact" bodyClassName="flex flex-wrap gap-2">
        {whatsappHref ? (
          <Button asChild variant="secondary" size="sm">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" />
              WhatsApp
            </a>
          </Button>
        ) : null}
        {mailtoHref ? (
          <Button asChild variant="outline" size="sm">
            <a href={mailtoHref}>
              <Mail className="size-4" />
              Email
            </a>
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm">
          <a href={telHref}>
            <Phone className="size-4" />
            {phoneDisplay}
          </a>
        </Button>
      </Panel>

      <Panel title="Overview">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Orders" value={customer.ordersCount} />
          {customer.totalRequested != null ? (
            <Stat label="Requested" value={formatPaise(customer.totalRequested)} />
          ) : null}
          <Stat
            label="First order"
            value={customer.firstOrderAt ? formatDateIST(customer.firstOrderAt) : "—"}
          />
          <Stat
            label="Last order"
            value={customer.lastOrderAt ? formatDateIST(customer.lastOrderAt) : "—"}
          />
        </dl>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Order history */}
        <Panel
          title="Order history"
          description={`${customer.orders.length} ${customer.orders.length === 1 ? "order" : "orders"}`}
          className="lg:col-span-3"
        >
          {customer.orders.length === 0 ? (
            <EmptyState
              title="No orders"
              description="This customer record has no linked orders yet."
            />
          ) : (
            <AdminTable caption="Order history">
              <AdminTableHeader>
                <AdminTableHead>Order</AdminTableHead>
                <AdminTableHead>Placed</AdminTableHead>
                <AdminTableHead className="text-right">Total</AdminTableHead>
                <AdminTableHead>Status</AdminTableHead>
                <AdminTableHead>Payment</AdminTableHead>
              </AdminTableHeader>
              <AdminTableBody>
                {customer.orders.map((order) => {
                  const statusMeta = ORDER_STATUS[order.status];
                  const payMeta = PAYMENT_STATUS[order.paymentStatus];
                  return (
                    <AdminTableRow key={order.id}>
                      <AdminTableCell label="Order">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {order.orderNumber}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {order._count.items}{" "}
                          {order._count.items === 1 ? "item" : "items"}
                        </div>
                      </AdminTableCell>
                      <AdminTableCell label="Placed">
                        <span className="text-sm text-muted-foreground">
                          {formatDateTimeIST(order.createdAt)}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell label="Total" className="text-right">
                        {formatPaise(order.grandTotal)}
                      </AdminTableCell>
                      <AdminTableCell label="Status">
                        <StatusBadge tone={statusMeta.tone} label={statusMeta.label} />
                      </AdminTableCell>
                      <AdminTableCell label="Payment">
                        <StatusBadge tone={payMeta.tone} label={payMeta.label} />
                      </AdminTableCell>
                    </AdminTableRow>
                  );
                })}
              </AdminTableBody>
            </AdminTable>
          )}
        </Panel>

        {/* CRM */}
        <Panel
          title="Tags & notes"
          description="Private CRM details for this customer."
          className="lg:col-span-2"
        >
          <CustomerCrmForm
            id={customer.id}
            tags={customer.tags}
            notes={customer.notes}
          />
        </Panel>
      </div>
    </div>
  );
}
