/**
 * Admin write-schemas for the Content/CMS surface (doc 15) — PURE (no DB, no
 * `server-only`): used by Server Actions, admin forms, and unit tests alike.
 *
 * Names/fields/enums follow CANON §5/§6 + prisma/schema.prisma verbatim. Money is
 * integer **paise**. The homepage payload union is keyed on the Prisma
 * `HomepageSectionType` enum (closed renderer set — doc 15 FR-5/FR-7). JSON
 * sub-shapes match `@/types` (SocialLinks / ShippingDefaults / DefaultSeo /
 * AnnouncementBar) and doc 03 §3.5.
 *
 * Rich-text bodies are validated for presence/length here; HTML **sanitization**
 * is a separate server-side step (doc 15 FR-28) and is not this module's job.
 */

import { z } from "zod";
import { HomepageSectionType, BannerType } from "@prisma/client";
import { emailSchema, phoneSchema } from "./common";

// ───────────────────────────── shared primitives ─────────────────────────────

/** Lowercase kebab-case ASCII slug (CANON §10). */
export const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required.")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens.");

/** Non-negative integer paise (money fields). */
const paiseSchema = z.number().int("Enter a whole amount.").min(0, "Cannot be negative.");

/** Optional cuid reference to a MediaAsset (image picker → `imageId`). */
const mediaIdSchema = z.string().trim().min(1).optional();

/** A relative path ("/products") or an absolute http(s) URL (doc 15 FR-33). */
export const linkSchema = z
  .string()
  .trim()
  .refine(
    (v) => v.startsWith("/") || /^https?:\/\//.test(v),
    "Enter a path starting with / or an https URL.",
  );

const httpsUrlSchema = z
  .string()
  .trim()
  .url("Enter a valid URL.")
  .refine((v) => /^https?:\/\//.test(v), "Must start with http(s)://");

/**
 * Optional IST datetime entered in the editor and coerced to a `Date` (stored
 * UTC). Accepts a `Date`, an ISO string, or an empty string (→ undefined).
 */
const optionalDate = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.date().optional(),
);

// ───────────────────────────── HomepageSection payloads ──────────────────────
//
// Keyed on the Prisma `HomepageSectionType` enum (doc 15 FR-7 discriminated
// union). Payload field shapes mirror doc 03 §3.5 + prisma/seed.ts. A shared
// heading/sub-copy is allowed on most sections; section-specific keys are added
// per type. `type` is the discriminant on every member.

const T = HomepageSectionType;

/** Common, optional heading/sub-copy carried by most homepage sections. */
const sectionHeading = {
  title: z.string().trim().max(120).optional(),
  sub: z.string().trim().max(300).optional(),
};

const heroPayload = z.object({
  type: z.literal(T.hero),
  headline: z.string().trim().min(1, "Headline is required.").max(140),
  sub: z.string().trim().max(300).optional(),
  ctaLabel: z.string().trim().max(40).optional(),
  ctaHref: linkSchema.optional(),
  mediaId: mediaIdSchema,
});

const featuredProductsPayload = z.object({
  type: z.literal(T.featured_products),
  ...sectionHeading,
  collectionId: z.string().trim().min(1).optional(),
  productIds: z.array(z.string().trim().min(1)).max(24).optional(),
  limit: z.number().int().min(1).max(24).default(8),
});

const featuredCollectionsPayload = z.object({
  type: z.literal(T.featured_collections),
  ...sectionHeading,
  collectionIds: z.array(z.string().trim().min(1)).max(12).optional(),
  limit: z.number().int().min(1).max(12).default(6),
});

const categoryGridPayload = z.object({
  type: z.literal(T.category_grid),
  ...sectionHeading,
  limit: z.number().int().min(1).max(12).default(6),
});

const bestsellersPayload = z.object({
  type: z.literal(T.bestsellers),
  ...sectionHeading,
  collectionSlug: slugSchema.optional(),
  limit: z.number().int().min(1).max(24).default(8),
});

const testimonialsPayload = z.object({
  type: z.literal(T.testimonials),
  ...sectionHeading,
  featuredOnly: z.boolean().default(true),
  limit: z.number().int().min(1).max(12).default(6),
});

const bannerPayload = z.object({
  type: z.literal(T.banner),
  ...sectionHeading,
  bannerId: z.string().trim().min(1).optional(),
  mediaId: mediaIdSchema,
  href: linkSchema.optional(),
});

const storyPayload = z.object({
  type: z.literal(T.story),
  title: z.string().trim().max(120).optional(),
  /** Rich HTML body (sanitized server-side separately). */
  body: z.string().trim().min(1, "Story text is required.").max(8000),
  mediaId: mediaIdSchema,
  ctaLabel: z.string().trim().max(40).optional(),
  ctaHref: linkSchema.optional(),
});

const instagramPayload = z.object({
  type: z.literal(T.instagram),
  ...sectionHeading,
  handle: z.string().trim().max(60).optional(),
  tiles: z
    .array(
      z.object({
        mediaId: z.string().trim().min(1),
        href: httpsUrlSchema,
      }),
    )
    .max(12)
    .optional(),
});

const newsletterPayload = z.object({
  type: z.literal(T.newsletter),
  title: z.string().trim().max(120).optional(),
  sub: z.string().trim().max(300).optional(),
  consentText: z.string().trim().max(400).optional(),
});

const faqPayload = z.object({
  type: z.literal(T.faq),
  ...sectionHeading,
  faqIds: z.array(z.string().trim().min(1)).max(12).optional(),
  limit: z.number().int().min(1).max(12).default(6),
});

const richTextPayload = z.object({
  type: z.literal(T.rich_text),
  title: z.string().trim().max(120).optional(),
  /** Rich HTML body (sanitized server-side separately). */
  body: z.string().trim().min(1, "Content is required.").max(8000),
});

/**
 * Discriminated union of every `HomepageSection.payload`, keyed on `type`
 * (doc 15 FR-7). Storefront skips a section whose payload fails this at render
 * time (doc 05 §7 graceful degradation).
 */
export const homepageSectionPayloadSchema = z.discriminatedUnion("type", [
  heroPayload,
  featuredProductsPayload,
  featuredCollectionsPayload,
  categoryGridPayload,
  bestsellersPayload,
  testimonialsPayload,
  bannerPayload,
  storyPayload,
  instagramPayload,
  newsletterPayload,
  faqPayload,
  richTextPayload,
]);

export type HomepageSectionPayload = z.infer<typeof homepageSectionPayloadSchema>;

/** Full create/update input for a `HomepageSection` row. */
export const homepageSectionInputSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens.")
    .optional(),
  payload: homepageSectionPayloadSchema,
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export type HomepageSectionInput = z.infer<typeof homepageSectionInputSchema>;

/** Reorder payload (doc 15 FR-8 — re-index densely on save). */
export const reorderSchema = z.object({
  orderedIds: z.array(z.string().trim().min(1)).min(1),
});

// ───────────────────────────── Banner ─────────────────────────────

/**
 * `Banner` upsert (doc 15 §6.2 / FR-9–FR-12). `startsAt ≤ endsAt` when both are
 * present. `text` is required for `marquee` (it has no image); `hero`/`promo`
 * may be image-led.
 */
export const bannerInputSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    type: z.nativeEnum(BannerType),
    text: z.string().trim().max(200).optional(),
    imageId: mediaIdSchema,
    link: linkSchema.optional(),
    startsAt: optionalDate,
    endsAt: optionalDate,
    sortOrder: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
  })
  .refine(
    (b) => !(b.startsAt && b.endsAt) || b.startsAt <= b.endsAt,
    { message: "Start must be on or before end.", path: ["endsAt"] },
  )
  .refine((b) => b.type !== BannerType.marquee || !!b.text?.trim(), {
    message: "Marquee text is required.",
    path: ["text"],
  });

export type BannerInput = z.infer<typeof bannerInputSchema>;

// ───────────────────────────── Testimonial ─────────────────────────────

/** `Testimonial` upsert (doc 15 §6.3 / FR-13–FR-15). New rows default unapproved. */
export const testimonialInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  customerName: z.string().trim().min(2, "Name is required.").max(80),
  location: z.string().trim().max(80).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  text: z.string().trim().min(1, "Quote is required.").max(1000),
  imageId: mediaIdSchema,
  sortOrder: z.number().int().min(0).default(0),
  isFeatured: z.boolean().default(false),
});

export type TestimonialInput = z.infer<typeof testimonialInputSchema>;

// ───────────────────────────── FaqItem ─────────────────────────────

/** `FaqItem` upsert (doc 15 §6.3 / FR-16–FR-18). `answer` is rich HTML. */
export const faqItemInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  question: z.string().trim().min(1, "Question is required.").max(200),
  answer: z.string().trim().min(1, "Answer is required.").max(4000),
  category: z.string().trim().max(60).optional(),
  sortOrder: z.number().int().min(0).default(0),
  isPublished: z.boolean().default(true),
});

export type FaqItemInput = z.infer<typeof faqItemInputSchema>;

// ───────────────────────────── CmsPage ─────────────────────────────

/**
 * `CmsPage` publish/update (doc 15 §6.4 / FR-19–FR-22). `title` + `bodyRich`
 * required to publish; `bodyRich` is sanitized server-side separately (FR-28).
 * `expectedUpdatedAt` powers the optimistic-concurrency stale-guard (FR-25).
 */
export const cmsPageInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  slug: slugSchema,
  title: z.string().trim().min(1, "Title is required.").max(160),
  bodyRich: z.string().trim().min(1, "Page content is required.").max(60000),
  metaTitle: z.string().trim().max(60, "Keep meta titles ≤ 60 characters.").optional(),
  metaDescription: z
    .string()
    .trim()
    .max(155, "Keep meta descriptions ≤ 155 characters.")
    .optional(),
  isPublished: z.boolean().default(false),
  expectedUpdatedAt: z.coerce.date().optional(),
});

export type CmsPageInput = z.infer<typeof cmsPageInputSchema>;

// ───────────────────────────── SiteSetting ─────────────────────────────

/** `SiteSetting.socialLinks` (@/types SocialLinks). All optional https URLs. */
export const socialLinksSchema = z.object({
  instagram: httpsUrlSchema.optional(),
  facebook: httpsUrlSchema.optional(),
  pinterest: httpsUrlSchema.optional(),
  youtube: httpsUrlSchema.optional(),
  whatsapp: httpsUrlSchema.optional(),
});

/** `SiteSetting.shippingDefaults` (@/types ShippingDefaults). Money is paise. */
export const shippingDefaultsSchema = z.object({
  flatRatePaise: paiseSchema,
  freeShippingThresholdPaise: paiseSchema,
  codEnabled: z.boolean().default(false),
});

/** `SiteSetting.defaultSeo` (@/types DefaultSeo). titleTemplate must contain %s. */
export const defaultSeoSchema = z.object({
  titleTemplate: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine((v) => v.includes("%s"), 'Title template must contain "%s".'),
  defaultDescription: z.string().trim().min(1).max(300),
  ogImageId: mediaIdSchema,
  twitterHandle: z
    .string()
    .trim()
    .max(20)
    .regex(/^@?\w{1,15}$/, "Enter a valid Twitter/X handle.")
    .optional(),
});

/** `SiteSetting.announcementBar` (@/types AnnouncementBar). */
export const announcementBarSchema = z.object({
  enabled: z.boolean().default(false),
  text: z.string().trim().max(200).default(""),
  href: linkSchema.optional(),
});

/** GSTIN format (15-char) — validated only when present (doc 15 FR-32). */
const gstinSchema = z
  .string()
  .trim()
  .regex(
    /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/,
    "Enter a valid 15-character GSTIN.",
  );

/** Business address used for footer / invoices / `Organization` schema (doc 03 §3.5). */
export const businessAddressSchema = z.object({
  legalName: z.string().trim().min(1, "Legal name is required.").max(160),
  line1: z.string().trim().max(160).optional(),
  line2: z.string().trim().max(160).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  pincode: z.string().trim().max(10).optional(),
  country: z.literal("IN").default("IN"),
  gstin: gstinSchema.optional(),
});

/**
 * Full `SiteSetting` write (doc 15 §4.7 / FR-30–FR-33). Single sectioned form;
 * every nested JSON block is validated. `whatsappNumber` is normalized to a bare
 * 10-digit Indian number via the shared `phoneSchema` (the storefront builds
 * `wa.me/91…` from it) — invalid numbers block the save (FR-33, core handoff).
 */
export const siteSettingsInputSchema = z.object({
  storeName: z.string().trim().min(1, "Store name is required.").max(120),
  contactEmail: emailSchema,
  whatsappNumber: phoneSchema,
  socialLinks: socialLinksSchema.optional(),
  shippingDefaults: shippingDefaultsSchema.optional(),
  gstin: gstinSchema.optional(),
  currency: z.literal("INR").default("INR"),
  defaultSeo: defaultSeoSchema.optional(),
  logoId: mediaIdSchema,
  announcementBar: announcementBarSchema.optional(),
  businessAddress: businessAddressSchema.optional(),
});

export type SiteSettingsInput = z.infer<typeof siteSettingsInputSchema>;
