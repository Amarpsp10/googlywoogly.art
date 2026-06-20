import type { Metadata } from "next";

import { getShippingDefaults } from "@/lib/services/settings";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/storefront/container";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { TrackView } from "@/components/analytics/track-view";
import type { ShippingDefaults } from "@/types";

/**
 * `/checkout` — single-page guest checkout shell (doc `08` §4.3, §8).
 *
 * RSC shell: reads the authoritative shipping config server-side and hands it to
 * the client `<CheckoutForm>` so the on-screen order summary is priced with the
 * same numbers `placeOrder` will recompute (`08` FR-21/FR-30). There is **no
 * on-site payment** — this page captures order intent only.
 *
 * SEO: `noindex,nofollow` and excluded from the sitemap (`08` §8; CANON `04`
 * §8.3). Nothing here is indexable; it is rendered fresh per request because the
 * cart and totals are entirely client-side.
 */

export const metadata: Metadata = buildMetadata({
  title: "Checkout",
  description:
    "Securely place your order — no payment now. We confirm and arrange easy payment on WhatsApp.",
  path: "/checkout",
  noindex: true,
});

export default async function CheckoutPage() {
  // Authoritative shipping config (paise). Fall back to the seed defaults until
  // the SiteSetting singleton is configured, matching `/cart` + `placeOrder`.
  const raw = (await getShippingDefaults()) as Partial<ShippingDefaults> | null;
  const shippingDefaults: ShippingDefaults = {
    flatRatePaise: raw?.flatRatePaise ?? 7900,
    freeShippingThresholdPaise: raw?.freeShippingThresholdPaise ?? 150000,
    codEnabled: raw?.codEnabled ?? false,
  };

  return (
    <Container as="main" className="py-8 md:py-12">
      <TrackView type="begin_checkout" />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Cart", href: "/cart" },
          { label: "Checkout" },
        ]}
      />

      <header className="mb-8">
        <h1 className="font-serif text-3xl font-bold md:text-4xl">Checkout</h1>
        <p className="mt-2 max-w-prose text-muted-foreground text-pretty">
          Just your contact and delivery details — no payment now. We&apos;ll
          confirm your handmade order and share easy payment options on WhatsApp.
        </p>
      </header>

      <CheckoutForm shippingDefaults={shippingDefaults} />
    </Container>
  );
}
