import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle, Phone } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CONTACT_STATUS } from "@/lib/constants";
import { formatDateTimeIST } from "@/lib/format";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { toWhatsAppDigits, toTelHref, formatPhoneDisplay } from "@/lib/admin/phone";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { MessageForm } from "./message-form";

export const metadata: Metadata = { title: "Message" };

export default async function MessageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const message = await prisma.contactMessage.findUnique({ where: { id } });
  if (!message) notFound();

  const meta = CONTACT_STATUS[message.status];
  const subjectLine = message.subject ? `Re: ${message.subject}` : "Re: Your message";
  const mailtoHref = `mailto:${message.email}?subject=${encodeURIComponent(subjectLine)}`;
  const whatsappHref = message.phone
    ? buildWhatsAppLink(toWhatsAppDigits(message.phone))
    : "";
  const telHref = message.phone ? toTelHref(message.phone) : "";
  const phoneDisplay = message.phone ? formatPhoneDisplay(message.phone) : "";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/admin/messages"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to messages
        </Link>
        <AdminPageHeader
          title={message.subject || `Message from ${message.name}`}
          description={`From ${message.name} · ${formatDateTimeIST(message.createdAt)}`}
          action={<StatusBadge tone={meta.tone} label={meta.label} />}
        />
      </div>

      <Panel title="Reply" bodyClassName="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm">
          <a href={mailtoHref}>
            <Mail className="size-4" />
            Reply by email
          </a>
        </Button>
        {whatsappHref ? (
          <Button asChild variant="outline" size="sm">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" />
              WhatsApp
            </a>
          </Button>
        ) : null}
        {telHref ? (
          <Button asChild variant="outline" size="sm">
            <a href={telHref}>
              <Phone className="size-4" />
              Call
            </a>
          </Button>
        ) : null}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Message">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Email
              </dt>
              <dd>
                <a href={mailtoHref} className="hover:text-primary">
                  {message.email}
                </a>
              </dd>
            </div>
            {message.phone ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Phone
                </dt>
                <dd>
                  <a href={telHref} className="hover:text-primary">
                    {phoneDisplay}
                  </a>
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Message
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-foreground">
                {message.message}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Manage" description="Track where this message stands.">
          <MessageForm id={message.id} status={message.status} />
        </Panel>
      </div>
    </div>
  );
}
