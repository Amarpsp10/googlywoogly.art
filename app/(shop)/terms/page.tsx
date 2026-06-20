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
 * Terms & Conditions (doc 15 §7.1–§7.2, slug `terms`). Pure CmsPage with a
 * code-default fallback (FR-21). Describes the WhatsApp-payment ordering model,
 * pricing/availability, IP, liability and Jaipur jurisdiction — gateway-ready.
 */
export const revalidate = 86400;

const SLUG = "terms";
const TITLE = "Terms & Conditions";
const DESCRIPTION =
  "The terms for using GooglyWoogly Art: our WhatsApp-based ordering and payment model, pricing, made-to-order, personalisation, intellectual property, liability and governing law.";

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
  { label: "Terms & Conditions" },
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

export default async function TermsPage() {
  const [page, settings] = await Promise.all([getCmsPage(SLUG), getSiteSettings()]);
  const heading = page?.title ?? TITLE;
  const updatedAt = page?.lastReviewedAt ?? page?.updatedAt ?? null;
  const legalName = settings?.businessAddress?.legalName ?? "GooglyWoogly Art";
  const gstin = settings?.gstin ?? settings?.businessAddress?.gstin ?? "";

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
            Welcome to {legalName} (&ldquo;GooglyWoogly Art&rdquo;, &ldquo;we&rdquo;,
            &ldquo;us&rdquo;). By browsing this website and placing an order, you agree to the terms
            below. Please read them carefully.
          </p>

          <h2>1. Acceptance &amp; eligibility</h2>
          <p>
            By using this site you confirm you are at least 18 years old (or accessing it under the
            supervision of a parent or guardian) and able to enter into a binding agreement.
          </p>

          <h2>2. How ordering works</h2>
          <p>
            This website lets you browse our catalogue and place a <strong>request to order</strong>.
            <strong> No payment is taken on the website.</strong> After you place a request, we
            confirm availability and then <strong>collect payment and coordinate delivery with you
            on WhatsApp</strong> (typically via UPI or bank transfer). An order becomes binding only
            once we have confirmed it and received payment.
          </p>

          <h2>3. Pricing &amp; availability</h2>
          <ul>
            <li>All prices are in Indian Rupees (₹ / INR).</li>
            <li>
              Taxes are charged as shown or as applicable; prices and availability may change
              without notice.
            </li>
            <li>
              As our products are handmade, slight variations in colour, finish and size are normal
              and expected.
            </li>
            <li>
              We may correct errors, and decline or cancel an order — for example in cases of
              mispricing, suspected fraud, or items being out of stock. If we cancel a paid order,
              we&apos;ll refund you in full.
            </li>
          </ul>

          <h2>4. Made-to-order items</h2>
          <p>
            Many pieces are made to order. The crafting lead times shown are good-faith estimates
            and may vary slightly. Please see our{" "}
            <Link href="/shipping-policy">Shipping &amp; Delivery Policy</Link> and{" "}
            <Link href="/returns-and-refunds">Cancellation &amp; Refund Policy</Link>.
          </p>

          <h2>5. Personalisation &amp; gift messages</h2>
          <p>
            Where you provide text for personalisation or a gift message, you are responsible for
            its accuracy (spelling, names, dates). We craft personalised items exactly as supplied,
            so they cannot be returned for errors in the text you provided.
          </p>

          <h2>6. Intellectual property</h2>
          <p>
            All content on this site — including designs, artwork, product photographs, text and the
            GooglyWoogly Art name and logo — is the property of {legalName} and is protected by law.
            You may not reproduce, resell or use it without our written permission.
          </p>

          <h2>7. Acceptable use</h2>
          <p>
            You agree not to misuse the site, attempt to disrupt it, or use it for any unlawful
            purpose.
          </p>

          <h2>8. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, our liability for any claim relating to a
            product or order is limited to the amount you paid for that order. We are not liable for
            indirect or consequential losses.
          </p>

          <h2>9. Indemnity</h2>
          <p>
            You agree to indemnify {legalName} against any claims arising from your misuse of the
            site or breach of these terms.
          </p>

          <h2>10. GST &amp; invoicing</h2>
          <p>
            {gstin
              ? `We are registered under GST (GSTIN: ${gstin}); tax invoices are issued with GST where applicable.`
              : "Where we are registered under GST, tax invoices are issued with GST as applicable."}
          </p>

          <h2>11. Governing law &amp; jurisdiction</h2>
          <p>
            These terms are governed by the laws of India. Any disputes are subject to the exclusive
            jurisdiction of the courts at <strong>Jaipur, Rajasthan</strong>.
          </p>

          <h2>12. Contact</h2>
          <p>
            For any questions about these terms or to raise a dispute, please{" "}
            <Link href="/contact">contact us</Link>.
          </p>
        </article>
      )}

      <p className="mt-10 max-w-3xl rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Draft — please review with the founder before launch.
      </p>

      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Terms & Conditions", path: `/${SLUG}` },
        ])}
      />
    </Container>
  );
}
