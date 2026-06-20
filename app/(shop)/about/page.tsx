import type { ReactNode } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Heart, Sparkles, Package, MessageCircle, Instagram } from "lucide-react";
import { getCmsPage } from "@/lib/services/content";
import { Container } from "@/components/storefront/container";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbLd } from "@/lib/seo/jsonld";

/**
 * About / Our Story (doc 15 §7.1–§7.2, slug `about`). Pure CmsPage: when a
 * published `CmsPage` exists its sanitized body is rendered; otherwise the
 * code-default story below is shown so the page is never empty (FR-21).
 * Indexable, ISR per the storefront content safety-net.
 */
export const revalidate = 86400;

const SLUG = "about";
const TITLE = "Our Story";
const DESCRIPTION =
  "GooglyWoogly Art is handmade gifting & home décor, designed and crafted with love in Jaipur by Vanshika Bhatia. Every piece is one of a kind.";

/**
 * Long-form rich-text styling. Self-contained Tailwind arbitrary variants (no
 * `@tailwindcss/typography` plugin is configured), so injected CMS HTML and the
 * default bodies render with consistent, on-theme spacing and headings.
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

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage(SLUG);
  return buildMetadata({
    title: page?.metaTitle ?? `${page?.title ?? TITLE} · About`,
    description: page?.metaDescription ?? DESCRIPTION,
    path: `/${SLUG}`,
  });
}

const CRUMBS = [
  { label: "Home", href: "/" },
  { label: "Our Story" },
];

export default async function AboutPage() {
  const page = await getCmsPage(SLUG);
  const heading = page?.title ?? TITLE;

  return (
    <Container as="main" className="py-8 md:py-12">
      <Breadcrumbs items={CRUMBS} />

      {/* Hero */}
      <header className="relative mb-12 overflow-hidden rounded-3xl bg-gradient-to-br from-pastel-pink/40 via-background to-pastel-mint/30 p-8 text-center md:p-14">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/50 px-4 py-1.5 text-sm font-medium text-foreground">
          <Sparkles className="size-4" /> Handmade in Jaipur
        </span>
        <h1 className="font-serif text-3xl font-bold text-balance md:text-5xl">{heading}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground text-pretty">
          {DESCRIPTION}
        </p>
      </header>

      {page?.bodyRich ? (
        <article
          className={cn("mx-auto max-w-3xl", RICH_TEXT)}
          dangerouslySetInnerHTML={{ __html: page.bodyRich }}
        />
      ) : (
        <DefaultStory />
      )}

      {/* CTAs */}
      <div className="mx-auto mt-14 flex max-w-3xl flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button asChild className="rounded-full">
          <Link href="/collections/bestsellers">Shop bestsellers</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/bulk-orders">Bulk &amp; corporate gifting</Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-full">
          <Link href="/contact">
            <Instagram className="size-4" /> Say hello
          </Link>
        </Button>
      </div>

      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Our Story", path: "/about" }])} />
    </Container>
  );
}

/** The founder-editable default story rendered until a CmsPage is published. */
function DefaultStory() {
  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <p className="text-lg text-pretty text-foreground/90">
        GooglyWoogly Art began with a simple belief: a gift made by hand carries a little
        piece of the maker&apos;s heart. From a sunlit studio in Jaipur, every piece is
        designed and crafted slowly, deliberately, and with a whole lot of love.
      </p>

      <Pillar
        icon={<Heart className="size-6" />}
        title="A note from Vanshika"
        body={
          <>
            <p>
              Hi, I&apos;m <strong>Vanshika Bhatia</strong>, the founder and maker behind
              GooglyWoogly Art. I started this little studio because I wanted gifting to feel
              personal again — not picked off a shelf, but made for someone. What began as a
              hobby of painting mugs and trinkets for friends grew into a brand built around
              one idea: <em>handmade joy, delivered.</em>
            </p>
            <p>
              I still make and check every order myself. When you buy from GooglyWoogly, you&apos;re
              not supporting a factory — you&apos;re supporting a small, hands-on craft practice
              rooted in Jaipur&apos;s rich tradition of artistry.
            </p>
          </>
        }
      />

      <Pillar
        icon={<Sparkles className="size-6" />}
        title="Each piece is one of a kind"
        body={
          <p>
            Because everything is made by hand, no two pieces are ever identical. A brushstroke
            here, a tiny variation there — these aren&apos;t flaws. They&apos;re the signature
            of something genuinely handmade, and the reason your piece is truly yours.
          </p>
        }
      />

      <Pillar
        icon={<Package className="size-6" />}
        title="Made to order, with care"
        body={
          <p>
            Many of our pieces are <strong>made to order</strong> — crafted only once you&apos;ve
            placed your request. This keeps our craft thoughtful and reduces waste, and it means
            a short lead time on those items. You&apos;ll always see the estimated crafting time
            on the product page so you can plan around your occasion.
          </p>
        }
      />

      <Pillar
        icon={<Sparkles className="size-6" />}
        title="Our materials & Jaipur roots"
        body={
          <p>
            We work with materials we love and trust — ceramics, wood, brass, fabric, resin and
            hand-mixed paints — sourced thoughtfully and finished by hand. Jaipur has been a home
            to craft for generations, and we&apos;re proud to add our small, colourful chapter to
            that story.
          </p>
        }
      />

      <Pillar
        icon={<MessageCircle className="size-6" />}
        title="How ordering works"
        body={
          <>
            <p>It&apos;s simple, warm and personal — just the way gifting should be:</p>
            <ol>
              <li>Browse the studio and add your favourites to the cart.</li>
              <li>Place your request — no payment is taken on the website.</li>
              <li>
                We confirm availability and <strong>take payment &amp; coordinate on WhatsApp</strong>.
              </li>
              <li>We craft your piece with care and ship it across India, with tracking.</li>
            </ol>
          </>
        }
      />
    </div>
  );
}

function Pillar({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm md:p-8">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-pastel-pink/30 text-primary">
          {icon}
        </span>
        <h2 className="font-serif text-xl font-bold md:text-2xl">{title}</h2>
      </div>
      <div className={RICH_TEXT}>{body}</div>
    </section>
  );
}
