import "server-only";

import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  SocialLinks,
  ShippingDefaults,
  DefaultSeo,
  AnnouncementBar,
  Address,
} from "@/types";

/**
 * Site-settings reads (CANON §5 `SiteSetting`; doc 15 §3.9). The singleton row is
 * seeded (id = "singleton"), but every accessor handles `null` gracefully so the
 * storefront never crashes if the row is missing.
 *
 * Wrapped in React `cache()` for request-level dedup: many RSCs (header, footer,
 * homepage sections, WhatsApp CTAs, JSON-LD) read settings within one render, and
 * we want a single DB round-trip per request. Cross-request freshness comes from
 * the `settings`/`nav` cache tags busted on admin save (doc 15 FR-31).
 */

const siteSettingSelect = {
  id: true,
  storeName: true,
  contactEmail: true,
  whatsappNumber: true,
  socialLinks: true,
  shippingDefaults: true,
  gstin: true,
  currency: true,
  defaultSeo: true,
  logoId: true,
  logo: { select: { url: true, alt: true, width: true, height: true } },
  announcementBar: true,
  businessAddress: true,
  updatedAt: true,
} satisfies Prisma.SiteSettingSelect;

type SiteSettingRow = Prisma.SiteSettingGetPayload<{ select: typeof siteSettingSelect }>;

/**
 * The singleton `SiteSetting` with its JSON columns narrowed to the documented
 * `@/types` shapes (doc 03 §3.5). Prisma types JSON as `JsonValue`; we re-type
 * the known sub-shapes here so callers get precise types without re-parsing.
 */
export type SiteSettings = Omit<
  SiteSettingRow,
  "socialLinks" | "shippingDefaults" | "defaultSeo" | "announcementBar" | "businessAddress"
> & {
  socialLinks: SocialLinks | null;
  shippingDefaults: ShippingDefaults | null;
  defaultSeo: DefaultSeo | null;
  announcementBar: AnnouncementBar | null;
  businessAddress: (Address & { legalName: string; gstin?: string }) | null;
};

/**
 * Fetch the singleton site settings (request-deduped). Returns `null` only if the
 * row has not been seeded — callers should fall back to sensible defaults.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings | null> => {
  const row = await prisma.siteSetting.findUnique({
    where: { id: "singleton" },
    select: siteSettingSelect,
  });
  if (!row) return null;

  // JSON columns are stored against the documented shapes (validated on write by
  // lib/validations/content). Narrow them for consumers; the `?? null` guards a
  // never-set column.
  return {
    ...row,
    socialLinks: (row.socialLinks as SocialLinks | null) ?? null,
    shippingDefaults: (row.shippingDefaults as ShippingDefaults | null) ?? null,
    defaultSeo: (row.defaultSeo as DefaultSeo | null) ?? null,
    announcementBar: (row.announcementBar as AnnouncementBar | null) ?? null,
    businessAddress:
      (row.businessAddress as (Address & { legalName: string; gstin?: string }) | null) ??
      null,
  };
});

/**
 * Convenience accessor for shipping defaults (used by cart/checkout + the trust
 * strip). Returns `null` when settings or the block are unset.
 */
export const getShippingDefaults = cache(
  async (): Promise<ShippingDefaults | null> => {
    const settings = await getSiteSettings();
    return settings?.shippingDefaults ?? null;
  },
);

/**
 * Convenience accessor for the WhatsApp number (digits as stored). Empty string
 * when unset so WhatsApp CTAs can be hidden (doc 14 FR-25).
 */
export const getWhatsAppNumber = cache(async (): Promise<string> => {
  const settings = await getSiteSettings();
  return settings?.whatsappNumber ?? "";
});
