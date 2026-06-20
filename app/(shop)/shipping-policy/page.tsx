import Link from "next/link";
import type { Metadata } from "next";
import { getCmsPage } from "@/lib/services/content";
import { getSiteSettings, getShippingDefaults } from "@/lib/services/settings";
import { Container } from "@/components/storefront/container";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbLd } from "@/lib/seo/jsonld";
import { formatPaise } from "@/lib/money";
import { formatDayIST } from "@/lib/format";

/**
 * Shipping & Delivery Policy (doc 15 §7.1–§7.2, slug `shipping-policy`). Pure
 * CmsPage with a code-default body so the page never 404s and is gateway-ready
 * (FR-21). Shipping figures are filled live from `SiteSetting.shippingDefaults`.
 */
export const revalidate = 86400;

const SLUG = "shipping-policy";
const TITLE = "Shipping & Delivery Policy";
const DESCRIPTION =
  "How GooglyWoogly Art ships handmade gifts pan-India: dispatch and made-to-order timelines, shipping charges, free-shipping threshold, tracking and delays.";

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
  { label: "Shipping & Delivery" },
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

export default async function ShippingPolicyPage() {
  const [page, settings, shipping] = await Promise.all([
    getCmsPage(SLUG),
    getSiteSettings(),
    getShippingDefaults(),
  ]);

  const heading = page?.title ?? TITLE;
  const updatedAt = page?.lastReviewedAt ?? page?.updatedAt ?? null;
  const flatRate =
    shipping?.flatRatePaise != null ? formatPaise(shipping.flatRatePaise) : "₹99";
  const freeOver =
    shipping?.freeShippingThresholdPaise != null
      ? formatPaise(shipping.freeShippingThresholdPaise)
      : "₹999";
  const whatsapp = settings?.whatsappNumber ?? "";

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
            Every GooglyWoogly order is packed and shipped with care from our studio in Jaipur.
            Because much of what we make is handmade and made-to-order, please read the timelines
            below so you can plan around your occasion.
          </p>

          <h2>Where we ship</h2>
          <p>
            We currently ship <strong>across India (pan-India)</strong>. International orders are
            available only on request through our{" "}
            <Link href="/bulk-orders">bulk / enquiry</Link> route — please message us before
            ordering.
          </p>

          <h2>Processing &amp; dispatch time</h2>
          <ul>
            <li>
              <strong>In-stock / ready-made items:</strong> typically dispatched within{" "}
              <strong>2–4 business days</strong>.
            </li>
            <li>
              <strong>Made-to-order items:</strong> crafted only after your order is confirmed.
              The estimated crafting lead time is shown on each product page; dispatch follows
              once the piece is ready.
            </li>
            <li>
              Orders are processed on business days (Mon–Sat, excluding public holidays), in IST.
            </li>
          </ul>

          <h2>Shipping charges</h2>
          <ul>
            <li>
              A flat shipping charge of <strong>{flatRate}</strong> applies to most orders.
            </li>
            <li>
              <strong>Free shipping</strong> on all orders over <strong>{freeOver}</strong>.
            </li>
            <li>Any applicable charges are confirmed with you on WhatsApp before payment.</li>
          </ul>

          <h2>Couriers &amp; tracking</h2>
          <p>
            Orders are dispatched via reputable courier partners. Once your parcel ships, we share
            the tracking details with you on WhatsApp or email, and you can follow it via the
            private order-tracking link sent when you place your order.
          </p>

          <h2>Delivery estimates</h2>
          <ul>
            <li>
              <strong>Metro cities:</strong> usually 3–6 business days after dispatch.
            </li>
            <li>
              <strong>Other locations:</strong> usually 5–9 business days after dispatch.
            </li>
            <li>
              During festive seasons (e.g. Diwali, Rakhi) couriers can be slower — we recommend
              ordering early.
            </li>
          </ul>

          <h2>Delays &amp; lost parcels</h2>
          <p>
            Delivery timelines are estimates and can be affected by courier delays, weather,
            strikes or other events beyond our control. If your parcel is delayed or appears lost,
            message us on WhatsApp{whatsapp ? ` (${whatsapp})` : ""} and we&apos;ll help trace it
            with the courier and make it right.
          </p>

          <h2>Address accuracy</h2>
          <p>
            Please double-check your delivery address and pincode at checkout. We&apos;re not
            responsible for orders delayed or returned due to an incorrect or incomplete address.
            If a delivery pincode isn&apos;t serviceable, we&apos;ll reach out to arrange an
            alternative.
          </p>

          <h2>Questions?</h2>
          <p>
            See our <Link href="/returns-and-refunds">Cancellation &amp; Refund Policy</Link> or{" "}
            <Link href="/contact">contact us</Link> — we&apos;re happy to help.
          </p>
        </article>
      )}

      <p className="mt-10 max-w-3xl rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Draft — please review with the founder before launch.
      </p>

      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Shipping & Delivery", path: `/${SLUG}` },
        ])}
      />
    </Container>
  );
}
