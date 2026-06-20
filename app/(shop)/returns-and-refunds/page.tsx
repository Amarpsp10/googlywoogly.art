import Link from "next/link";
import type { Metadata } from "next";
import { getCmsPage } from "@/lib/services/content";
import { getSiteSettings } from "@/lib/services/settings";
import { Container } from "@/components/storefront/container";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbLd } from "@/lib/seo/jsonld";
import { formatDayIST } from "@/lib/format";

/**
 * Cancellation & Refund Policy (doc 15 §7.1–§7.2, slug `returns-and-refunds`).
 * Pure CmsPage with code-default fallback (FR-21). Honours the founder's rules:
 * 7-day returns on ready-made items only; personalised & made-to-order are final
 * sale; damaged/defective always replaced; refunds coordinated on WhatsApp.
 */
export const revalidate = 86400;

const SLUG = "returns-and-refunds";
const TITLE = "Cancellation & Refund Policy";
const DESCRIPTION =
  "GooglyWoogly Art's cancellation and refund policy: 7-day returns on ready-made items, made-to-order and personalised exclusions, and how damaged items are replaced.";

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
  { label: "Cancellation & Refunds" },
];

/**
 * Long-form policy styling via self-contained Tailwind arbitrary variants (no
 * `@tailwindcss/typography` plugin is configured), applied to both the injected
 * CMS HTML and the default body so headings/lists render consistently on-theme.
 */
const RICH_TEXT =
  "max-w-3xl text-foreground/90 leading-relaxed " +
  "[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground md:[&_h2]:text-2xl " +
  "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-serif [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground " +
  "[&_p]:my-4 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80 " +
  "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5 [&_li]:marker:text-primary " +
  "[&_strong]:font-semibold [&_strong]:text-foreground [&_em]:italic " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground " +
  "[&_hr]:my-8 [&_hr]:border-border [&_img]:my-6 [&_img]:rounded-2xl";

export default async function ReturnsAndRefundsPage() {
  const [page, settings] = await Promise.all([getCmsPage(SLUG), getSiteSettings()]);
  const heading = page?.title ?? TITLE;
  const updatedAt = page?.lastReviewedAt ?? page?.updatedAt ?? null;
  const whatsapp = settings?.whatsappNumber ?? "";
  const email = settings?.contactEmail ?? "";

  return (
    <Container as="main" className="py-8 md:py-12">
      <Breadcrumbs items={CRUMBS} />

      <header className="mb-8 border-b border-border pb-6">
        <h1 className="font-serif text-3xl font-bold text-balance md:text-4xl">{heading}</h1>
        {updatedAt && (
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: {formatDayIST(updatedAt)}
          </p>
        )}
      </header>

      {page?.bodyRich ? (
        <article className={RICH_TEXT} dangerouslySetInnerHTML={{ __html: page.bodyRich }} />
      ) : (
        <article className={RICH_TEXT}>
          <p>
            We want you to love your GooglyWoogly piece. Because everything is handmade — and much
            of it is made or personalised just for you — please read the policy below carefully
            before ordering.
          </p>

          <h2>Cancelling an order</h2>
          <ul>
            <li>
              <strong>Ready-made items:</strong> you can cancel any time before the order is
              dispatched.
            </li>
            <li>
              <strong>Made-to-order &amp; personalised items:</strong> you can cancel before we
              begin production. Once crafting/personalisation has started, the order can no longer
              be cancelled.
            </li>
            <li>
              To cancel, message us on WhatsApp{whatsapp ? ` (${whatsapp})` : ""} with your order
              number as soon as possible.
            </li>
          </ul>

          <h2>Returns</h2>
          <p>
            We accept returns on <strong>ready-made items only</strong>, within{" "}
            <strong>7 days</strong> of delivery. To be eligible, the item must be unused, in its
            original condition and packaging.
          </p>
          <p>
            <strong>Personalised and made-to-order items are final sale</strong> and cannot be
            returned or exchanged (unless they arrive damaged or defective — see below). Because
            these are crafted specifically for you, they can&apos;t be resold.
          </p>

          <h2>Damaged, defective or wrong items</h2>
          <p>
            If your order arrives damaged, defective or incorrect, we will always make it right —
            this applies to <strong>every</strong> item, including personalised and made-to-order
            pieces. Please:
          </p>
          <ul>
            <li>
              Report it within <strong>48 hours</strong> of delivery via WhatsApp
              {whatsapp ? ` (${whatsapp})` : ""}
              {email ? <> or email <a href={`mailto:${email}`}>{email}</a></> : null}.
            </li>
            <li>Share clear photos, and ideally an unboxing video, of the issue and the packaging.</li>
            <li>
              Once verified, we&apos;ll arrange a <strong>replacement or a full refund</strong>,
              whichever you prefer.
            </li>
          </ul>

          <h2>How refunds work</h2>
          <p>
            Since payment is collected directly on WhatsApp (UPI or bank transfer), approved
            refunds are processed the same way — back to your original payment method or a method
            you confirm with us.
          </p>
          <ul>
            <li>Refunds are initiated once your cancellation or return is approved.</li>
            <li>
              Please allow <strong>5–7 business days</strong> for the amount to reflect in your
              account after we initiate it.
            </li>
            <li>
              Shipping charges (if any) are non-refundable except where the item was damaged,
              defective or wrong.
            </li>
          </ul>

          <h2>Non-returnable items</h2>
          <ul>
            <li>Personalised and made-to-order pieces (unless damaged/defective).</li>
            <li>Items returned after the 7-day window or not in original condition.</li>
            <li>Sale or clearance items, where marked.</li>
          </ul>

          <h2>Need help?</h2>
          <p>
            We&apos;re a small studio and we genuinely want you to be happy.{" "}
            <Link href="/contact">Reach out</Link> and we&apos;ll do our best to sort it out.
          </p>
        </article>
      )}

      <p className="mt-10 max-w-3xl rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Draft — please review with the founder before launch.
      </p>

      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Cancellation & Refunds", path: `/${SLUG}` },
        ])}
      />
    </Container>
  );
}
