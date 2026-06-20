import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle, Mail, Phone } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listAssignableAdmins } from "@/lib/admin/crm";
import { INQUIRY_STATUS } from "@/lib/constants";
import { formatPaise } from "@/lib/money";
import { formatDateTimeIST, formatDateIST } from "@/lib/format";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { toWhatsAppDigits, toTelHref, formatPhoneDisplay } from "@/lib/admin/phone";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { InquiryForm } from "./inquiry-form";

export const metadata: Metadata = { title: "Inquiry" };

/** One label/value row in the read-only details grid. */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2.5 last:border-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-40 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default async function BulkInquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [inquiry, admins] = await Promise.all([
    prisma.bulkInquiry.findUnique({ where: { id } }),
    listAssignableAdmins(),
  ]);

  if (!inquiry) notFound();

  const meta = INQUIRY_STATUS[inquiry.status];
  const firstName = inquiry.name.trim().split(/\s+/)[0] || "there";

  // Founder → lead quick-reply, prefilled and addressed to the customer's number.
  const whatsappMessage = `Hi ${firstName}, thank you for your bulk-gifting enquiry with GooglyWoogly Art! I'd love to help — could we discuss the details?`;
  const whatsappHref = buildWhatsAppLink(toWhatsAppDigits(inquiry.phone), whatsappMessage);
  const telHref = toTelHref(inquiry.phone);
  const phoneDisplay = formatPhoneDisplay(inquiry.phone);
  const emailSubject = `Re: Your bulk gifting enquiry${inquiry.company ? ` — ${inquiry.company}` : ""}`;
  const mailtoHref = `mailto:${inquiry.email}?subject=${encodeURIComponent(emailSubject)}`;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/admin/bulk-inquiries"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to inquiries
        </Link>
        <AdminPageHeader
          title={inquiry.name}
          description={
            inquiry.company
              ? `${inquiry.company} · received ${formatDateTimeIST(inquiry.createdAt)}`
              : `Received ${formatDateTimeIST(inquiry.createdAt)}`
          }
          action={<StatusBadge tone={meta.tone} label={meta.label} />}
        />
      </div>

      {/* Quick reply */}
      <Panel title="Quick reply" bodyClassName="flex flex-wrap gap-2">
        {whatsappHref ? (
          <Button asChild variant="secondary" size="sm">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" />
              WhatsApp
            </a>
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm">
          <a href={mailtoHref}>
            <Mail className="size-4" />
            Email
          </a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={telHref}>
            <Phone className="size-4" />
            Call
          </a>
        </Button>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Inquiry details */}
        <Panel title="Inquiry details">
          <dl>
            <DetailRow label="Name">{inquiry.name}</DetailRow>
            {inquiry.company ? (
              <DetailRow label="Company">{inquiry.company}</DetailRow>
            ) : null}
            <DetailRow label="Phone">
              <a href={telHref} className="hover:text-primary">
                {phoneDisplay}
              </a>
            </DetailRow>
            <DetailRow label="Email">
              <a href={mailtoHref} className="hover:text-primary">
                {inquiry.email}
              </a>
            </DetailRow>
            {inquiry.productInterest ? (
              <DetailRow label="Product interest">{inquiry.productInterest}</DetailRow>
            ) : null}
            {inquiry.quantity != null ? (
              <DetailRow label="Quantity">{inquiry.quantity}</DetailRow>
            ) : null}
            {inquiry.occasion ? (
              <DetailRow label="Occasion">{inquiry.occasion}</DetailRow>
            ) : null}
            {inquiry.budget != null ? (
              <DetailRow label="Budget">{formatPaise(inquiry.budget)}</DetailRow>
            ) : null}
            {inquiry.deadline ? (
              <DetailRow label="Needed by">{formatDateIST(inquiry.deadline)}</DetailRow>
            ) : null}
            <DetailRow label="Message">
              <p className="whitespace-pre-wrap">{inquiry.message}</p>
            </DetailRow>
          </dl>
        </Panel>

        {/* Manage */}
        <Panel
          title="Manage"
          description="Move it through the pipeline, assign an owner, and keep private notes."
        >
          <InquiryForm
            id={inquiry.id}
            status={inquiry.status}
            assignedToAdminId={inquiry.assignedToAdminId}
            internalNotes={inquiry.internalNotes}
            admins={admins}
          />
        </Panel>
      </div>
    </div>
  );
}
