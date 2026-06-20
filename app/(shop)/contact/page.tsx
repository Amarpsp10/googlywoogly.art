import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Clock, HelpCircle } from "lucide-react";
import { getSiteSettings } from "@/lib/services/settings";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbLd } from "@/lib/seo/jsonld";
import { Container } from "@/components/storefront/container";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { SectionHeading } from "@/components/storefront/section-heading";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/forms/contact-form";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "Contact us",
  description:
    "Get in touch with GooglyWoogly Art. Message us on WhatsApp or email for help with handmade gifts, custom orders, and your enquiries — we reply within 1 business day.",
  path: "/contact",
});

const WHATSAPP_PREFILL =
  "Hi GooglyWoogly Art! 👋 I have a question about your handmade gifts.";

export default async function ContactPage() {
  const settings = await getSiteSettings();
  const email = settings?.contactEmail ?? null;
  const whatsappNumber = settings?.whatsappNumber ?? "";
  const whatsappLink = buildWhatsAppLink(whatsappNumber, WHATSAPP_PREFILL);
  const address = settings?.businessAddress ?? null;
  const addressLine = address
    ? [address.line1, address.line2, address.city, address.state, address.pincode]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <Container as="main" className="py-8 md:py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />

      <header className="mx-auto max-w-2xl text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/50 px-4 py-1.5 text-sm font-medium text-foreground">
          <MessageCircle className="size-4" />
          We&apos;d love to hear from you
        </span>
        <h1 className="font-serif text-3xl font-bold text-balance md:text-4xl lg:text-5xl">
          Get in touch
        </h1>
        <p className="mt-3 text-lg text-muted-foreground text-pretty">
          Questions about a piece, a custom request, or your order? Message us on
          WhatsApp or drop a note below — we typically reply within 1 business day
          (IST).
        </p>
      </header>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        {/* Contact info */}
        <aside className="space-y-4">
          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15 text-[#128C7E]">
                <MessageCircle className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">WhatsApp</span>
                <span className="block text-sm text-muted-foreground">
                  Chat with us — the fastest way to reach the studio.
                </span>
              </span>
            </a>
          )}

          {email && (
            <a
              href={`mailto:${email}`}
              className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-pastel-lavender/50 text-foreground">
                <Mail className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">Email</span>
                <span className="block break-all text-sm text-muted-foreground">
                  {email}
                </span>
              </span>
            </a>
          )}

          {addressLine && (
            <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-pastel-mint/50 text-foreground">
                <MapPin className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">Studio</span>
                <span className="block text-sm text-muted-foreground">
                  {addressLine}
                </span>
              </span>
            </div>
          )}

          <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-pastel-yellow/60 text-foreground">
              <Clock className="size-5" />
            </span>
            <span>
              <span className="block font-semibold">Hours</span>
              <span className="block text-sm text-muted-foreground">
                Mon–Sat, 10am–7pm IST. We reply within 1 business day.
              </span>
            </span>
          </div>

          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-5">
            <div className="flex items-center gap-2 font-semibold">
              <HelpCircle className="size-4 text-primary" />
              Looking for a quick answer?
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Many questions about shipping, made-to-order timelines and payment
              are answered on our{" "}
              <a href="/faq" className="text-primary underline-offset-2 hover:underline">
                FAQ page
              </a>
              .
            </p>
          </div>
        </aside>

        {/* Contact form */}
        <section
          aria-labelledby="contact-form-heading"
          className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8"
        >
          <h2
            id="contact-form-heading"
            className="font-serif text-2xl font-bold"
          >
            Send us a message
          </h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            Fill in the form and we&apos;ll get back to you soon.
          </p>
          <ContactForm />
        </section>
      </div>

      {/* Bulk / corporate cross-sell */}
      <section className="mt-16 rounded-3xl bg-gradient-to-br from-pastel-pink/20 via-background to-pastel-mint/20 p-8 text-center md:p-12">
        <SectionHeading
          eyebrow="For teams & events"
          title="Gifting in bulk?"
          description="Custom-branded, volume-priced handmade gifts and curated hampers for corporate gifting, weddings and events."
        />
        <Button asChild size="lg" className="rounded-full">
          <a href="/bulk-orders">Explore bulk &amp; corporate gifting</a>
        </Button>
      </section>

      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />
    </Container>
  );
}
