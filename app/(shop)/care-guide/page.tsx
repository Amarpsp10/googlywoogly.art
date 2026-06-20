import type { ReactNode } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Sparkles,
  Droplets,
  Sun,
  Flame,
  Brush,
  TreePine,
  Shirt,
  Gem,
} from "lucide-react";
import { getCmsPage } from "@/lib/services/content";
import { Container } from "@/components/storefront/container";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbLd } from "@/lib/seo/jsonld";

/**
 * Care Guide (doc 15 §7.1–§7.2, slug `care-guide`). Pure CmsPage with a
 * code-default body (FR-21) of handmade-care tips by material; cross-links to
 * per-product care notes and the catalogue.
 */
export const revalidate = 86400;

const SLUG = "care-guide";
const TITLE = "Care Guide";
const DESCRIPTION =
  "How to care for your handmade GooglyWoogly pieces — material-by-material tips for ceramics, wood, brass, textiles, resin, hand-painted items and candles.";

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
  { label: "Care Guide" },
];

/**
 * Long-form styling via self-contained Tailwind arbitrary variants (no
 * `@tailwindcss/typography` plugin is configured), used for the injected CMS
 * body so headings/lists render consistently on-theme.
 */
const RICH_TEXT =
  "text-foreground/90 leading-relaxed " +
  "[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground md:[&_h2]:text-2xl " +
  "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-serif [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground " +
  "[&_p]:my-4 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80 " +
  "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5 [&_li]:marker:text-primary " +
  "[&_strong]:font-semibold [&_strong]:text-foreground [&_em]:italic " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground " +
  "[&_hr]:my-8 [&_hr]:border-border [&_img]:my-6 [&_img]:rounded-2xl";

interface CareSection {
  icon: ReactNode;
  title: string;
  tips: string[];
}

const SECTIONS: CareSection[] = [
  {
    icon: <Gem className="size-5" />,
    title: "Ceramics & pottery",
    tips: [
      "Hand-wash with mild soap and a soft sponge; avoid abrasive scrubbers.",
      "Unless marked otherwise, treat hand-painted ceramics as not dishwasher- or microwave-safe.",
      "Avoid sudden temperature changes, which can crack glaze.",
    ],
  },
  {
    icon: <TreePine className="size-5" />,
    title: "Wood",
    tips: [
      "Wipe clean with a dry or lightly damp cloth — never soak.",
      "Keep away from prolonged moisture and direct heat to prevent warping.",
      "Occasionally condition with a little food-safe oil to keep it nourished.",
    ],
  },
  {
    icon: <Sparkles className="size-5" />,
    title: "Brass & metal",
    tips: [
      "Dust regularly with a soft, dry cloth.",
      "Polish gently with a brass cleaner; natural patina over time is normal.",
      "Keep dry to avoid tarnish, and avoid harsh chemical cleaners.",
    ],
  },
  {
    icon: <Shirt className="size-5" />,
    title: "Textiles & fabric",
    tips: [
      "Gentle hand-wash or spot-clean in cold water unless the label says otherwise.",
      "Dry in shade to protect colours; avoid wringing.",
      "Iron on low heat, inside out, and avoid any printed or embellished areas.",
    ],
  },
  {
    icon: <Droplets className="size-5" />,
    title: "Resin",
    tips: [
      "Wipe with a soft, damp cloth; avoid abrasive or alcohol-based cleaners.",
      "Keep out of prolonged direct sunlight, which can yellow resin over time.",
      "Avoid high heat — never place hot items directly on resin surfaces.",
    ],
  },
  {
    icon: <Brush className="size-5" />,
    title: "Hand-painted pieces",
    tips: [
      "Clean gently with a soft, barely-damp cloth — never scrub the painted surface.",
      "Avoid soaking and harsh cleaners, which can lift the paint.",
      "Tiny brushstroke variations are part of the handmade charm.",
    ],
  },
  {
    icon: <Flame className="size-5" />,
    title: "Candles",
    tips: [
      "Trim the wick to about 5 mm before each burn.",
      "Burn for no more than 3–4 hours at a time, away from drafts and flammables.",
      "Never leave a burning candle unattended, and let wax fully set before relighting.",
    ],
  },
];

export default async function CareGuidePage() {
  const page = await getCmsPage(SLUG);
  const heading = page?.title ?? TITLE;

  return (
    <Container as="main" className="py-8 md:py-12">
      <Breadcrumbs items={CRUMBS} />

      <header className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-pastel-mint/40 via-background to-pastel-lavender/30 p-8 text-center md:p-12">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/50 px-4 py-1.5 text-sm font-medium text-foreground">
          <Sparkles className="size-4" /> Made by hand, made to last
        </span>
        <h1 className="font-serif text-3xl font-bold text-balance md:text-5xl">{heading}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground text-pretty">
          A little care goes a long way. Treat your piece like the one-of-a-kind it is, and it&apos;ll
          stay lovely for years.
        </p>
      </header>

      {page?.bodyRich ? (
        <article
          className={cn("mx-auto max-w-3xl", RICH_TEXT)}
          dangerouslySetInnerHTML={{ __html: page.bodyRich }}
        />
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            {SECTIONS.map((section) => (
              <section
                key={section.title}
                className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pastel-pink/30 text-primary">
                    {section.icon}
                  </span>
                  <h2 className="font-serif text-lg font-bold">{section.title}</h2>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {section.tips.map((tip) => (
                    <li key={tip} className="flex gap-2">
                      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="text-pretty">{tip}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {/* General cautions */}
          <section className="mt-8 rounded-2xl bg-muted/40 p-6 md:p-8">
            <h2 className="mb-4 font-serif text-xl font-bold">A few golden rules</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Caution icon={<Sun className="size-5" />} label="Sunlight" text="Keep pieces out of harsh, direct sun to protect colours and finishes." />
              <Caution icon={<Droplets className="size-5" />} label="Moisture" text="Wipe up spills quickly and avoid soaking anything that isn't meant to be." />
              <Caution icon={<Flame className="size-5" />} label="Heat" text="Avoid placing items near direct heat or hot surfaces." />
            </div>
            <p className="mt-5 text-sm text-muted-foreground text-pretty">
              Small variations in colour, texture and finish are completely normal — they&apos;re the
              signature of something genuinely handmade, not a defect.
            </p>
          </section>
        </>
      )}

      {/* Cross-links */}
      <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-border/50 bg-card p-6 text-center shadow-sm">
        <p className="text-muted-foreground">
          Looking for care tips for a specific piece? Each product page lists its own care
          instructions.
        </p>
        <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="rounded-full">
            <Link href="/products">Browse all products</Link>
          </Button>
          <Button asChild variant="ghost" className="rounded-full">
            <Link href="/contact">Ask us anything</Link>
          </Button>
        </div>
      </div>

      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Care Guide", path: `/${SLUG}` },
        ])}
      />
    </Container>
  );
}

function Caution({
  icon,
  label,
  text,
}: {
  icon: ReactNode;
  label: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-primary">
        {icon}
      </span>
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-muted-foreground text-pretty">{text}</p>
      </div>
    </div>
  );
}
