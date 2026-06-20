import type { ReactNode } from "react";
import { getSiteSettings } from "@/lib/services/settings";
import { CartProvider } from "@/components/cart/cart-provider";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { AnnouncementBar } from "@/components/site/announcement-bar";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { WhatsAppFloat } from "@/components/site/whatsapp-float";
import { BackToTop } from "@/components/site/back-to-top";
import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
import { ConsentBanner } from "@/components/analytics/consent-banner";

/**
 * Storefront layout — the customer-facing chrome (cart, header, footer, WhatsApp).
 * Lives in the `(shop)` route group so `/admin/*` (its own layout) doesn't inherit it.
 * Route groups don't change URLs: `/products` etc. are unchanged.
 */
export default async function ShopLayout({ children }: { children: ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <CartProvider>
      <AnalyticsProvider>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <AnnouncementBar />
        <SiteHeader />
        {/* Skip-link / focus target. Not a <main> landmark because each page
            renders its own <main>; this wrapper just receives focus (tabindex
            -1) so keyboard users land on the content (doc 16 FR-13). */}
        <div id="main-content" tabIndex={-1} className="outline-none">
          {children}
        </div>
        <SiteFooter />
        <CartDrawer />
        <WhatsAppFloat number={settings?.whatsappNumber ?? ""} />
        <BackToTop />
        <ConsentBanner />
      </AnalyticsProvider>
    </CartProvider>
  );
}
