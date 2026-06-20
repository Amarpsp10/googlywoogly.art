import Link from "next/link";
import type { Metadata } from "next";
import { HelpCircle, MessageCircle } from "lucide-react";
import { getCmsPage, getPublishedFaqs, type FaqGroup } from "@/lib/services/content";
import { Container } from "@/components/storefront/container";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { EmptyState } from "@/components/storefront/empty-state";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { buildMetadata, absoluteUrl } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbLd } from "@/lib/seo/jsonld";

/**
 * FAQ (doc 15 §7.1, slug `faq`). Renders published `FaqItem`s grouped by
 * category as an accessible accordion, with an optional CmsPage intro and
 * `FAQPage` JSON-LD emitted only here (doc 15 FR-17/FR-18; doc 09 §5.5).
 */
export const revalidate = 86400;

const SLUG = "faq";
const TITLE = "Frequently Asked Questions";
const DESCRIPTION =
  "Answers about shipping, made-to-order timelines, personalisation, payments on WhatsApp, returns and care for your handmade GooglyWoogly pieces.";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage(SLUG);
  return buildMetadata({
    title: page?.metaTitle ?? page?.title ?? TITLE,
    description: page?.metaDescription ?? DESCRIPTION,
    path: `/${SLUG}`,
  });
}

const CRUMBS = [
  { label: "Home", href: "/" },
  { label: "FAQ" },
];

/**
 * Rich-text styling for FAQ answers and intro copy via self-contained Tailwind
 * arbitrary variants (no `@tailwindcss/typography` plugin is configured), so the
 * injected, sanitized answer HTML renders with on-theme lists/links.
 */
const ANSWER_TEXT =
  "text-muted-foreground leading-relaxed " +
  "[&_p]:my-3 first:[&_p]:mt-0 last:[&_p]:mb-0 " +
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80 " +
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_li]:marker:text-primary " +
  "[&_strong]:font-semibold [&_strong]:text-foreground [&_em]:italic";

/** Strip HTML to plain text for the FAQPage schema `acceptedAnswer.text`. */
function toPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function faqPageLd(groups: FaqGroup[]): object {
  const items = groups.flatMap((g) =>
    g.items
      .map((item) => ({ q: item.question, a: toPlainText(item.answer) }))
      .filter((x) => x.a.length > 0),
  );
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: absoluteUrl(`/${SLUG}`),
    mainEntity: items.map((x) => ({
      "@type": "Question",
      name: x.q,
      acceptedAnswer: { "@type": "Answer", text: x.a },
    })),
  };
}

export default async function FaqPage() {
  const [page, groups] = await Promise.all([getCmsPage(SLUG), getPublishedFaqs()]);
  const heading = page?.title ?? TITLE;
  const hasFaqs = groups.some((g) => g.items.length > 0);

  return (
    <Container as="main" className="py-8 md:py-12">
      <Breadcrumbs items={CRUMBS} />

      <header className="mb-10 text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/50 px-4 py-1.5 text-sm font-medium text-foreground">
          <HelpCircle className="size-4" /> We&apos;re here to help
        </span>
        <h1 className="font-serif text-3xl font-bold text-balance md:text-5xl">{heading}</h1>
        {page?.bodyRich ? (
          <div
            className={cn("mx-auto mt-4 max-w-2xl text-left", ANSWER_TEXT)}
            dangerouslySetInnerHTML={{ __html: page.bodyRich }}
          />
        ) : (
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground text-pretty">
            {DESCRIPTION}
          </p>
        )}
      </header>

      {hasFaqs ? (
        <div className="mx-auto max-w-3xl space-y-10">
          {groups
            .filter((g) => g.items.length > 0)
            .map((group) => (
              <section key={group.category}>
                <h2 className="mb-2 font-serif text-xl font-bold md:text-2xl">{group.category}</h2>
                <Accordion type="single" collapsible className="w-full">
                  {group.items.map((item) => (
                    <AccordionItem key={item.id} value={item.id} className="border-border">
                      <AccordionTrigger className="font-serif text-base font-semibold text-foreground hover:no-underline">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div
                          className={ANSWER_TEXT}
                          dangerouslySetInnerHTML={{ __html: item.answer }}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            ))}
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <EmptyState
            icon={<HelpCircle className="size-7" />}
            title="Answers coming soon"
            message="We're putting our FAQs together. In the meantime, message us on WhatsApp and we'll happily help."
            action={
              <Button asChild className="rounded-full">
                <Link href="/contact">Contact us</Link>
              </Button>
            }
          />
        </div>
      )}

      {/* Still-need-help nudge */}
      <div className="mx-auto mt-12 max-w-3xl rounded-2xl bg-gradient-to-br from-pastel-pink/20 to-pastel-mint/20 p-6 text-center md:p-8">
        <MessageCircle className="mx-auto mb-3 size-7 text-primary" />
        <h2 className="font-serif text-xl font-bold">Still have a question?</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          We&apos;re a small studio and we love a good chat. Reach out and a real person (often
          Vanshika herself) will get back to you.
        </p>
        <Button asChild className="mt-5 rounded-full">
          <Link href="/contact">Get in touch</Link>
        </Button>
      </div>

      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }])} />
      {hasFaqs && <JsonLd data={faqPageLd(groups)} />}
    </Container>
  );
}
