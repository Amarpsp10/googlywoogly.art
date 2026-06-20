"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { NON_STAFF_ROLES } from "@/lib/auth/types";
import { writeAudit } from "@/lib/admin/audit";
import { revalidateSettings, revalidateHome } from "@/lib/revalidate";
import { siteSettingsInputSchema } from "@/lib/validations/content";
import {
  field,
  optionalField,
  boolField,
  rupeeInputToPaise,
} from "@/lib/admin/content-shared";
import type { ContentFormState } from "../content/_components/content-form-state";
import { liveUrl, formOk, formFail, formValidationFail } from "../content/_actions/shared";

/**
 * `SiteSetting` Server Actions (doc 15 §6.4 / FR-30–FR-33). `requireRole(owner|
 * admin)` → assemble the sectioned form into the nested JSON shapes → validate
 * with `siteSettingsInputSchema` (WhatsApp E.164, GSTIN, `%s` in titleTemplate,
 * money ≥ 0) → upsert the singleton → `writeAudit("site_setting.update")` →
 * `revalidateSettings()` (busts `settings` + `nav`) + `revalidateHome()` when the
 * announcement bar changed + `/` (FR-31). Money is entered in ₹, stored paise.
 */

const ROLES = NON_STAFF_ROLES;
const SINGLETON_ID = "singleton";

/** Audited subset (business config — retained, not PII-redacted; FR-4 note). */
const auditSelect = {
  id: true,
  storeName: true,
  contactEmail: true,
  whatsappNumber: true,
  socialLinks: true,
  shippingDefaults: true,
  gstin: true,
  defaultSeo: true,
  logoId: true,
  announcementBar: true,
  businessAddress: true,
} satisfies Prisma.SiteSettingSelect;

/** Strip a nested object to `undefined` when every value is empty (keeps JSON tidy). */
function compact<T extends Record<string, unknown>>(obj: T): T | undefined {
  const hasValue = Object.values(obj).some((v) => v !== undefined && v !== "" && v !== null);
  return hasValue ? obj : undefined;
}

// ───────────────────────────── updateSiteSettings ─────────────────────────────

/** Single sectioned save of the `SiteSetting` singleton. Form action. */
export async function updateSiteSettings(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const admin = await requireRole(ROLES);

  // Money fields (₹ → paise). `null` ⇒ unparseable → surface a field error.
  const flatRate = rupeeInputToPaise(optionalField(formData, "flatRate"));
  const freeShip = rupeeInputToPaise(optionalField(formData, "freeShippingThreshold"));
  if (flatRate === null) {
    return formValidationFail({ flatRate: ["Enter a valid amount in ₹."] });
  }
  if (freeShip === null) {
    return formValidationFail({ freeShippingThreshold: ["Enter a valid amount in ₹."] });
  }

  const socialLinks = compact({
    instagram: optionalField(formData, "instagram"),
    facebook: optionalField(formData, "facebook"),
    pinterest: optionalField(formData, "pinterest"),
    youtube: optionalField(formData, "youtube"),
    whatsapp: optionalField(formData, "social_whatsapp"),
  });

  const shippingDefaults = {
    flatRatePaise: flatRate ?? 0,
    freeShippingThresholdPaise: freeShip ?? 0,
    codEnabled: boolField(formData, "codEnabled"),
  };

  const defaultSeo = compact({
    titleTemplate: optionalField(formData, "titleTemplate"),
    defaultDescription: optionalField(formData, "defaultDescription"),
    ogImageId: optionalField(formData, "ogImageId"),
    twitterHandle: optionalField(formData, "twitterHandle"),
  });

  const announcementBar = {
    enabled: boolField(formData, "announcementEnabled"),
    text: optionalField(formData, "announcementText") ?? "",
    href: optionalField(formData, "announcementHref"),
  };

  const businessAddress = compact({
    legalName: optionalField(formData, "legalName"),
    line1: optionalField(formData, "addressLine1"),
    line2: optionalField(formData, "addressLine2"),
    city: optionalField(formData, "city"),
    state: optionalField(formData, "state"),
    pincode: optionalField(formData, "pincode"),
    country: "IN" as const,
    gstin: optionalField(formData, "gstin"),
  });

  const candidate = {
    storeName: field(formData, "storeName"),
    contactEmail: field(formData, "contactEmail"),
    whatsappNumber: field(formData, "whatsappNumber"),
    socialLinks,
    shippingDefaults,
    gstin: optionalField(formData, "gstin"),
    currency: "INR" as const,
    defaultSeo:
      defaultSeo && defaultSeo.titleTemplate && defaultSeo.defaultDescription
        ? defaultSeo
        : undefined,
    logoId: optionalField(formData, "logoId"),
    announcementBar,
    businessAddress:
      businessAddress && businessAddress.legalName ? businessAddress : undefined,
  };

  const parsed = siteSettingsInputSchema.safeParse(candidate);
  if (!parsed.success) {
    return formValidationFail(parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  const data = {
    storeName: input.storeName,
    contactEmail: input.contactEmail,
    whatsappNumber: input.whatsappNumber,
    socialLinks: (input.socialLinks ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    shippingDefaults: (input.shippingDefaults ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    gstin: input.gstin ?? null,
    currency: input.currency,
    defaultSeo: (input.defaultSeo ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    logoId: input.logoId ?? null,
    announcementBar: (input.announcementBar ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    businessAddress: (input.businessAddress ?? Prisma.JsonNull) as Prisma.InputJsonValue,
  };

  try {
    const before = await prisma.siteSetting.findUnique({
      where: { id: SINGLETON_ID },
      select: auditSelect,
    });

    // Did the announcement bar (or marquee-affecting config) change? → also bust home.
    const announcementChanged =
      JSON.stringify(before?.announcementBar ?? null) !==
      JSON.stringify(input.announcementBar ?? null);

    await prisma.$transaction(async (tx) => {
      const after = await tx.siteSetting.upsert({
        where: { id: SINGLETON_ID },
        create: { id: SINGLETON_ID, ...data },
        update: data,
        select: auditSelect,
      });
      await writeAudit(
        { adminId: admin.id, action: "site_setting.update", entityType: "SiteSetting", entityId: SINGLETON_ID, before, after },
        tx,
      );
    });

    revalidateSettings();
    revalidatePath("/");
    if (announcementChanged) revalidateHome();

    return formOk("Settings saved — updates the header, footer, checkout, and emails.", liveUrl("/"));
  } catch (err) {
    console.error("[site_setting] update failed", err);
    return formFail("Couldn't save settings. Please try again.");
  }
}
