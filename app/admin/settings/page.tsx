import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { NON_STAFF_ROLES } from "@/lib/auth/types";
import { getSiteSettings } from "@/lib/services/settings";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { paiseToRupeeInput } from "@/lib/admin/content-shared";
import { SettingsForm, type SettingsFormData } from "./settings-form";

/**
 * `/admin/settings` — the `SiteSetting` editor (doc 15 §4.7, FR-30). SSR,
 * `requireRole(owner|admin)`. Reads the singleton and hydrates the sectioned
 * form; money columns (paise) are shown in ₹. `noindex` via the admin layout.
 */

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole(NON_STAFF_ROLES);

  const settings = await getSiteSettings();
  const address = settings?.businessAddress ?? null;

  const data: SettingsFormData = {
    storeName: settings?.storeName ?? "",
    contactEmail: settings?.contactEmail ?? "",
    whatsappNumber: settings?.whatsappNumber ?? "",
    logoId: settings?.logoId ?? undefined,
    gstin: settings?.gstin ?? address?.gstin ?? undefined,
    social: {
      instagram: settings?.socialLinks?.instagram,
      facebook: settings?.socialLinks?.facebook,
      pinterest: settings?.socialLinks?.pinterest,
      youtube: settings?.socialLinks?.youtube,
      whatsapp: settings?.socialLinks?.whatsapp,
    },
    shipping: {
      flatRateRupees: paiseToRupeeInput(settings?.shippingDefaults?.flatRatePaise),
      freeShipRupees: paiseToRupeeInput(settings?.shippingDefaults?.freeShippingThresholdPaise),
      codEnabled: settings?.shippingDefaults?.codEnabled ?? false,
    },
    seo: {
      titleTemplate: settings?.defaultSeo?.titleTemplate,
      defaultDescription: settings?.defaultSeo?.defaultDescription,
      ogImageId: settings?.defaultSeo?.ogImageId,
      twitterHandle: settings?.defaultSeo?.twitterHandle,
    },
    announcement: {
      enabled: settings?.announcementBar?.enabled ?? false,
      text: settings?.announcementBar?.text ?? "",
      href: settings?.announcementBar?.href,
    },
    address: {
      legalName: address?.legalName,
      line1: address?.line1,
      line2: address?.line2,
      city: address?.city,
      state: address?.state,
      pincode: address?.pincode,
    },
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Settings"
        description="Your store config — updates the header, footer, checkout, emails, and structured data."
        action={
          <Button asChild variant="outline" size="sm" className="min-h-9">
            <Link href="/" target="_blank" rel="noopener">
              View store <ExternalLink className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />
      <SettingsForm data={data} />
    </div>
  );
}
