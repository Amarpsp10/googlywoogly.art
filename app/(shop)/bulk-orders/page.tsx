import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarHeart,
  Gift,
  Handshake,
  MapPin,
  MessageCircle,
  PartyPopper,
  Quote,
  ReceiptText,
  Sparkles,
  Tag,
  Trophy,
  UserPlus,
} from "lucide-react";
import { getSiteSettings } from "@/lib/services/settings";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { buildMetadata, absoluteUrl, SITE_NAME } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbLd } from "@/lib/seo/jsonld";
import { Container } from "@/components/storefront/container";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { SectionHeading } from "@/components/storefront/section-heading";
import { Button } from "@/components/ui/button";
import { BulkOrderForm } from "@/components/forms/bulk-order-form";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "Corporate & Bulk Gifting — Handmade in Jaipur",
  description:
    "Custom-branded, volume-priced handmade gifts and curated hampers for corporate Diwali, employee onboarding kits, wedding favors and events. Personally managed by our founder, delivered across India. GST invoice on request.",
  path: "/bulk-orders",
});

const WHATSAPP_PREFILL =
  "Hi GooglyWoogly Art! 👋 I'd like to talk about corporate / bulk gifting.";

const VALUE_PROPS = [
  {
    icon: Tag,
    title: "Custom branding & personalisation",
    body: "Add your logo, brand colours, a bespoke message card, or fully custom designs — gifts that feel like you.",
  },
  {
    icon: ReceiptText,
    title: "Volume pricing",
    body: "The more you order, the better the per-unit price. Tell us your quantity and budget for a tailored quote.",
  },
  {
    icon: Gift,
    title: "Curated hampers & sets",
    body: "Ready-made and bespoke gift hampers — mix handmade pieces into beautiful sets for any occasion.",
  },
] as const;

const PRIMARY_USE_CASES = [
  {
    icon: PartyPopper,
    title: "Corporate Diwali gifting",
    body: "Delight employees and clients this Diwali with handmade, branded gift sets — ordered once, delivered everywhere.",
  },
  {
    icon: UserPlus,
    title: "Employee onboarding & welcome kits",
    body: "Make day one memorable with curated welcome kits — personalised with each joiner's name.",
  },
  {
    icon: CalendarHeart,
    title: "Wedding favors & return gifts",
    body: "Handcrafted return gifts your guests will actually keep — in your wedding's colours and scale.",
  },
] as const;

const SECONDARY_USE_CASES = [
  { icon: Handshake, label: "Client & partner gifting" },
  { icon: Building2, label: "Conference & event swag" },
  { icon: Trophy, label: "Milestone & appreciation gifts" },
] as const;

const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Tell us what you need",
    body: "Share your brief via the form or WhatsApp — quantity, occasion, branding and deadline.",
  },
  {
    step: 2,
    title: "Get a personal quote",
    body: "Vanshika replies, usually within 1 business day, with options and per-unit pricing.",
  },
  {
    step: 3,
    title: "We handcraft your order",
    body: "Made to order in our Jaipur studio, to an agreed lead time — every piece by hand.",
  },
  {
    step: 4,
    title: "Delivered across India",
    body: "Carefully packed and dispatched pan-India with tracking. GST invoice on request.",
  },
] as const;

const TRUST_POINTS = [
  "Handmade at scale",
  "Custom branding",
  "Made in Jaipur",
  "Pan-India delivery",
  "Personally managed by our founder",
] as const;

const BULK_TESTIMONIALS = [
  {
    quote:
      "Vanshika handled our 120-piece Diwali order end to end — branded, beautifully packed, and delivered on time across three cities.",
    name: "People & Culture Lead",
    org: "Growing tech team",
  },
  {
    quote:
      "Our onboarding kits finally feel personal. Each new joiner gets a handmade welcome set with their name on it.",
    name: "HR Manager",
    org: "Series-A startup",
  },
] as const;

const BULK_FAQS = [
  {
    q: "Is there a minimum order quantity?",
    a: "There's no rigid minimum — share your quantity and we'll tailor a quote. Volume pricing improves as your order grows.",
  },
  {
    q: "How fast can you deliver bulk orders?",
    a: "Because pieces are handmade to order, lead time depends on quantity and customisation. We'll confirm a realistic timeline with your quote — tell us your deadline and we'll be honest about feasibility.",
  },
  {
    q: "Can you ship internationally?",
    a: "Yes — international bulk gifting is handled directly over WhatsApp. Send us the destination and quantities and we'll work out shipping.",
  },
  {
    q: "Do you provide a GST invoice?",
    a: "GST invoices are available on request for eligible orders. Just let us know your billing details when we prepare your quote.",
  },
  {
    q: "How do payments work for bulk orders?",
    a: "We quote first, then share an invoice and payment details over WhatsApp — production begins once the order is confirmed.",
  },
] as const;

export default async function BulkOrdersPage() {
  const settings = await getSiteSettings();
  const whatsappNumber = settings?.whatsappNumber ?? "";
  const whatsappLink = buildWhatsAppLink(whatsappNumber, WHATSAPP_PREFILL);
  const gstin = settings?.businessAddress?.gstin ?? null;

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Corporate & Bulk Gifting",
    serviceType: "Corporate gifting",
    provider: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
    areaServed: { "@type": "Country", name: "India" },
    url: absoluteUrl("/bulk-orders"),
    description:
      "Custom-branded, volume-priced handmade gifts and curated hampers for corporate gifting, onboarding kits, weddings and events. Made to order in Jaipur, delivered across India.",
  };

  return (
    <main>
      {/* A. Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-pastel-pink/25 via-background to-pastel-lavender/30">
        <Container className="py-12 md:py-20">
          <Breadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Bulk Orders" }]}
          />
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-sm font-medium text-foreground shadow-sm">
              <Sparkles className="size-4 text-primary" />
              Corporate &amp; bulk gifting
            </span>
            <h1 className="font-serif text-4xl font-bold text-balance md:text-5xl lg:text-6xl">
              Handmade corporate &amp; bulk gifting, made in Jaipur
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground text-pretty">
              Custom-branded gifts, curated hampers and volume pricing for teams,
              clients and events — handcrafted, personally managed by our founder,
              and delivered across India. GST invoice on request.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full rounded-full sm:w-auto">
                <a href="#inquiry">
                  Request a quote
                  <ArrowRight className="size-4" />
                </a>
              </Button>
              {whatsappLink && (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full rounded-full sm:w-auto"
                >
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-5" />
                    Chat on WhatsApp
                  </a>
                </Button>
              )}
            </div>
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground">
              {["Made to order", "Custom branding", "Pan-India delivery", "GST invoice available"].map(
                (item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </div>
        </Container>
      </section>

      {/* B. Value propositions */}
      <section aria-labelledby="value-props">
        <Container className="py-16 md:py-24">
          <SectionHeading
            eyebrow="Why bulk with us"
            title="Gifting that scales — without losing the handmade touch"
          />
          <span id="value-props" className="sr-only">
            Bulk gifting value propositions
          </span>
          <div className="grid gap-6 md:grid-cols-3">
            {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md"
              >
                <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-pastel-pink/30 text-primary">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h3 className="font-serif text-xl font-bold">{title}</h3>
                <p className="mt-2 text-muted-foreground text-pretty">{body}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      {/* C. Occasion use-cases */}
      <section className="bg-muted/30 py-16 md:py-24">
        <Container>
          <SectionHeading
            eyebrow="Occasions we love"
            title="Gifting for every team moment"
            description="From festive gifting to milestone moments — here's where handmade makes a difference."
          />
          <div className="grid gap-6 md:grid-cols-3">
            {PRIMARY_USE_CASES.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-pastel-lavender/50 text-foreground">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h3 className="font-serif text-xl font-bold">{title}</h3>
                <p className="mt-2 flex-1 text-muted-foreground text-pretty">
                  {body}
                </p>
                <a
                  href="#inquiry"
                  className="group mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Ask about this
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </a>
              </article>
            ))}
          </div>

          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {SECONDARY_USE_CASES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium shadow-sm"
              >
                <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* D. How it works */}
      <section aria-labelledby="how-it-works">
        <Container className="py-16 md:py-24">
          <SectionHeading
            eyebrow="Simple, personal, honest"
            title="How bulk gifting works"
          />
          <span id="how-it-works" className="sr-only">
            How bulk gifting works
          </span>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map(({ step, title, body }) => (
              <li
                key={step}
                className="relative rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <span
                  className="flex size-10 items-center justify-center rounded-full bg-primary font-serif text-lg font-bold text-primary-foreground"
                  aria-hidden="true"
                >
                  {step}
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
                  {body}
                </p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* E. Social proof & trust */}
      <section className="bg-gradient-to-br from-pastel-mint/20 via-background to-pastel-yellow/20 py-16 md:py-24">
        <Container>
          <SectionHeading
            eyebrow="Trusted for the details"
            title="Built for procurement, made by hand"
            description="Trusted by growing teams across India for thoughtful gifting that arrives on time."
          />

          <div className="grid gap-6 md:grid-cols-2">
            {BULK_TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <Quote className="size-7 text-primary/40" aria-hidden="true" />
                <blockquote className="mt-3 flex-1 text-pretty text-foreground/90">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-4 text-sm font-semibold">
                  {t.name}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {t.org}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {TRUST_POINTS.map((point) => (
              <li
                key={point}
                className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium shadow-sm"
              >
                <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>

          <div className="mx-auto mt-6 flex max-w-xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ReceiptText className="size-4 text-primary" aria-hidden="true" />
              {gstin
                ? `GST invoice available (GSTIN: ${gstin})`
                : "GST invoice available on request"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4 text-primary" aria-hidden="true" />
              Handcrafted in Jaipur, India
            </span>
          </div>
        </Container>
      </section>

      {/* F. Inquiry form */}
      <section id="inquiry" className="scroll-mt-24">
        <Container className="py-16 md:py-24">
          <div className="mx-auto max-w-3xl">
            <SectionHeading
              eyebrow="Tell us about your gifting"
              title="Request a quote"
              description="Share a few details and we'll get back to you within 1 business day with a personal quote. Fields marked * are required."
            />
            <BulkOrderForm whatsappNumber={whatsappNumber} />
          </div>
        </Container>
      </section>

      {/* G. Bulk FAQ + final CTA */}
      <section className="bg-muted/30 py-16 md:py-24">
        <Container className="mx-auto max-w-3xl">
          <SectionHeading eyebrow="Good to know" title="Bulk gifting FAQ" />
          <dl className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {BULK_FAQS.map(({ q, a }) => (
              <div key={q} className="p-6">
                <dt className="font-semibold">{q}</dt>
                <dd className="mt-1.5 text-muted-foreground text-pretty">{a}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-12 rounded-3xl bg-gradient-to-br from-pastel-pink/25 via-background to-pastel-mint/25 p-8 text-center md:p-12">
            <h2 className="font-serif text-2xl font-bold md:text-3xl">
              Ready to start your gifting?
            </h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground text-pretty">
              Send your brief and get a personal quote — or message us directly on
              WhatsApp.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full rounded-full sm:w-auto">
                <a href="#inquiry">Request a quote</a>
              </Button>
              {whatsappLink && (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full rounded-full sm:w-auto"
                >
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-5" />
                    Chat on WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </div>
        </Container>
      </section>

      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Bulk Orders", path: "/bulk-orders" },
        ])}
      />
      <JsonLd data={serviceLd} />
    </main>
  );
}
