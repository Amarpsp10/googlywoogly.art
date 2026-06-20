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
 * Privacy Policy (doc 15 §7.1–§7.2, slug `privacy-policy`) — DPDP-aware. Pure
 * CmsPage with a code-default fallback (FR-21) so it's always live for payment-
 * gateway review. Data-fiduciary and grievance details fill from `SiteSetting`.
 */
export const revalidate = 86400;

const SLUG = "privacy-policy";
const TITLE = "Privacy Policy";
const DESCRIPTION =
  "How GooglyWoogly Art collects, uses and protects your personal data, in line with India's Digital Personal Data Protection (DPDP) Act — including your rights and grievance redressal.";

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
  { label: "Privacy Policy" },
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

function formatBusinessAddress(
  addr: { line1: string; line2?: string; city: string; state: string; pincode: string } | null,
): string {
  if (!addr) return "Jaipur, Rajasthan, India";
  return [addr.line1, addr.line2, `${addr.city}, ${addr.state} ${addr.pincode}`]
    .filter(Boolean)
    .join(", ");
}

export default async function PrivacyPolicyPage() {
  const [page, settings] = await Promise.all([getCmsPage(SLUG), getSiteSettings()]);
  const heading = page?.title ?? TITLE;
  const updatedAt = page?.lastReviewedAt ?? page?.updatedAt ?? null;
  const legalName = settings?.businessAddress?.legalName ?? "GooglyWoogly Art";
  const address = formatBusinessAddress(settings?.businessAddress ?? null);
  const email = settings?.contactEmail ?? "";
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
            At {legalName} (&ldquo;GooglyWoogly Art&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), we
            respect your privacy and collect only the information we need to craft and deliver your
            order. This policy explains what we collect, why, and the rights you have under India&apos;s
            Digital Personal Data Protection (DPDP) Act, 2023.
          </p>

          <h2>Who we are (data fiduciary)</h2>
          <p>
            {legalName}, based at {address}.
            {email ? <> You can reach us at <a href={`mailto:${email}`}>{email}</a>.</> : null}
          </p>

          <h2>Information we collect</h2>
          <ul>
            <li>
              <strong>Contact &amp; order details:</strong> your name, phone number, email and
              shipping/billing address.
            </li>
            <li>
              <strong>Order content:</strong> the items you order and any optional gift messages or
              personalisation notes you choose to share.
            </li>
            <li>
              <strong>Basic analytics:</strong> a hashed visitor identifier, device type and pages
              viewed, to understand and improve the site. We keep this to a minimum.
            </li>
          </ul>
          <p>We do not knowingly collect more personal data than we need (data minimisation).</p>

          <h2>Why we use your data (purpose &amp; consent)</h2>
          <p>We process your data, with your consent, to:</p>
          <ul>
            <li>process and fulfil your order;</li>
            <li>coordinate payment and delivery with you on WhatsApp;</li>
            <li>send you transactional updates about your order;</li>
            <li>respond to your enquiries and provide support; and</li>
            <li>comply with applicable law and prevent fraud.</li>
          </ul>

          <h2>Who we share it with</h2>
          <p>
            We share data only as needed to run the store — for example with courier partners, our
            email/WhatsApp communication providers, and our hosting and analytics processors. We do
            <strong> not</strong> sell your personal data, and we don&apos;t use third-party
            advertising trackers.
          </p>

          <h2>Cookies &amp; analytics</h2>
          <p>
            We use first-party cookies and privacy-friendly analytics only — there are no
            third-party ad pixels. These help the site work and tell us, in aggregate, what&apos;s
            useful.
          </p>

          <h2>How long we keep it (retention)</h2>
          <p>
            We retain order and transaction records for as long as required to provide our service
            and to meet legal, tax and accounting obligations. Raw analytics events are kept for a
            limited period (typically 18–24 months). You can ask us to delete your personal data
            where we are not required to retain it.
          </p>

          <h2>Your rights under DPDP</h2>
          <p>You have the right to:</p>
          <ul>
            <li>access the personal data we hold about you;</li>
            <li>request correction of inaccurate or incomplete data;</li>
            <li>request erasure of your data (subject to legal retention);</li>
            <li>withdraw consent at any time; and</li>
            <li>raise a grievance and seek redressal.</li>
          </ul>
          <p>
            To exercise any of these, email{" "}
            {email ? <a href={`mailto:${email}`}>{email}</a> : <span>our contact email</span>}
            {whatsapp ? <> or message us on WhatsApp ({whatsapp})</> : null}.
          </p>

          <h2>Grievance Officer</h2>
          <p>
            In line with the DPDP Act, you may contact our Grievance Officer for any
            privacy-related concern:
          </p>
          <ul>
            <li>
              <strong>Name:</strong> Vanshika Bhatia
            </li>
            {email ? (
              <li>
                <strong>Email:</strong> <a href={`mailto:${email}`}>{email}</a>
              </li>
            ) : null}
            <li>
              <strong>Response time:</strong> we aim to acknowledge within 48 hours and resolve
              within a reasonable period.
            </li>
          </ul>

          <h2>Children</h2>
          <p>
            Our store is not directed at children, and we do not knowingly collect personal data
            from minors.
          </p>

          <h2>Security</h2>
          <p>
            We apply reasonable safeguards to protect your data. Note that payment is collected
            directly via WhatsApp (UPI/bank) — we do not store your card details on this site. If a
            data breach affecting you ever occurs, we will act promptly and notify you as required.
          </p>

          <h2>Changes to this policy</h2>
          <p>
            We may update this policy from time to time. The &ldquo;Last updated&rdquo; date above
            reflects the latest version.
          </p>

          <p>
            Questions? <Link href="/contact">Contact us</Link> — we&apos;re happy to help.
          </p>
        </article>
      )}

      <p className="mt-10 max-w-3xl rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Draft — please review with the founder before launch.
      </p>

      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Privacy Policy", path: `/${SLUG}` },
        ])}
      />
    </Container>
  );
}
