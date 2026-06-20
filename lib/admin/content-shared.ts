/**
 * Shared, **pure** helpers for the admin Content/CMS + Settings surface (doc 15).
 * No DB, no `server-only` — imported by Server Actions, RSC pages, and the
 * client form leaves alike. Form-field readers, money parsing, the banner
 * status-chip resolver, and the homepage-section renderer catalogue live here.
 */

import { BannerType, HomepageSectionType } from "@prisma/client";
import type { Tone } from "@/lib/constants";

// ───────────────────────────── FormData readers ─────────────────────────────

/** Read a FormData value as a trimmed string ("" when absent). */
export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Read an optional FormData value: `undefined` when blank (so Zod `.optional()` stays unset). */
export function optionalField(formData: FormData, name: string): string | undefined {
  const value = field(formData, name);
  return value.length > 0 ? value : undefined;
}

/** Read a checkbox/switch (`"on"`, `"true"`, `"1"` ⇒ true). */
export function boolField(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  if (typeof value !== "string") return false;
  return value === "on" || value === "true" || value === "1";
}

/** Read a non-negative integer, or `undefined` when blank/invalid. */
export function intField(formData: FormData, name: string): number | undefined {
  const value = field(formData, name);
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse a ₹ rupee input into integer **paise** (CANON §10). Accepts "1,299",
 * "1299.50", "₹999"; returns `undefined` when blank, `null` when unparseable
 * (callers surface a field error for `null`).
 */
export function rupeeInputToPaise(raw: string | undefined | null): number | null | undefined {
  if (raw == null) return undefined;
  const cleaned = raw.replace(/[₹,\s]/g, "").trim();
  if (!cleaned) return undefined;
  const rupees = Number.parseFloat(cleaned);
  if (!Number.isFinite(rupees) || rupees < 0) return null;
  return Math.round(rupees * 100);
}

/** Display integer paise as a plain rupee number for an input value (no symbol). */
export function paiseToRupeeInput(paise: number | null | undefined): string {
  if (paise == null) return "";
  return (paise / 100).toString();
}

/**
 * Format a stored UTC `Date` as a value for a `<input type="datetime-local">`
 * in **IST** (CANON §10). Returns "" for null. The matching parse is
 * `istLocalToDate` below.
 */
export function dateToISTLocalInput(date: Date | null | undefined): string {
  if (!date) return "";
  // Shift to IST (+05:30) then format as YYYY-MM-DDTHH:mm.
  const istMs = date.getTime() + 5.5 * 60 * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 16);
}

/**
 * Parse a `datetime-local` string (entered in IST) into a UTC `Date`. Returns
 * `undefined` for blank, `null` for an invalid string.
 */
export function istLocalToDate(raw: string | undefined | null): Date | null | undefined {
  if (raw == null) return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  // Treat the wall-clock value as IST: append the +05:30 offset.
  const parsed = new Date(`${value}:00+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// ───────────────────────────── banner status chip ─────────────────────────────

export type BannerLiveStatus = "live" | "scheduled" | "expired" | "off";

/**
 * Compute a banner's display status (doc 15 FR-10). A banner is *Live* only when
 * active and now ∈ [startsAt, endsAt] (open-ended when a bound is null).
 */
export function bannerStatus(
  banner: { isActive: boolean; startsAt: Date | null; endsAt: Date | null },
  now: Date = new Date(),
): BannerLiveStatus {
  if (!banner.isActive) return "off";
  if (banner.startsAt && banner.startsAt > now) return "scheduled";
  if (banner.endsAt && banner.endsAt < now) return "expired";
  return "live";
}

export const BANNER_STATUS_META: Record<BannerLiveStatus, { label: string; tone: Tone }> = {
  live: { label: "Live", tone: "success" },
  scheduled: { label: "Scheduled", tone: "info" },
  expired: { label: "Expired", tone: "neutral" },
  off: { label: "Off", tone: "neutral" },
};

export const BANNER_TYPE_META: Record<BannerType, { label: string; description: string }> = {
  [BannerType.marquee]: {
    label: "Announcement marquee",
    description: "Scrolling strip in the site header. Text required; no image.",
  },
  [BannerType.hero]: {
    label: "Hero campaign",
    description: "Large homepage hero override. Image-led.",
  },
  [BannerType.promo]: {
    label: "Promo bar",
    description: "Promotional strip usable in a homepage banner section.",
  },
};

// ───────────────────────────── homepage section catalogue ─────────────────────

/**
 * Renderer catalogue for the closed `HomepageSectionType` set (doc 15 FR-5/FR-6).
 * Drives the "Add section" picker, list labels, and singleton enforcement.
 * `singleton` types may only have one *active* instance (FR-6).
 */
export interface SectionTypeMeta {
  label: string;
  description: string;
  /** Only one active instance allowed (e.g. hero, newsletter). */
  singleton: boolean;
}

export const SECTION_TYPE_META: Record<HomepageSectionType, SectionTypeMeta> = {
  [HomepageSectionType.hero]: {
    label: "Hero",
    description: "Top banner with headline, sub-copy, CTA, and background image.",
    singleton: true,
  },
  [HomepageSectionType.featured_products]: {
    label: "Featured products",
    description: "A hand-picked or collection-sourced product rail.",
    singleton: false,
  },
  [HomepageSectionType.featured_collections]: {
    label: "Featured collections",
    description: "Shop-by-occasion / collection tiles.",
    singleton: false,
  },
  [HomepageSectionType.category_grid]: {
    label: "Category grid",
    description: "Auto grid of top-level categories.",
    singleton: true,
  },
  [HomepageSectionType.bestsellers]: {
    label: "Bestsellers",
    description: "Auto-sourced bestselling products.",
    singleton: true,
  },
  [HomepageSectionType.testimonials]: {
    label: "Testimonials",
    description: "Approved customer quotes carousel.",
    singleton: true,
  },
  [HomepageSectionType.banner]: {
    label: "Banner",
    description: "Image/promo banner block linked to a Banner row.",
    singleton: false,
  },
  [HomepageSectionType.story]: {
    label: "Our story",
    description: "Rich-text brand story with optional image.",
    singleton: false,
  },
  [HomepageSectionType.instagram]: {
    label: "Instagram",
    description: "Instagram handle + tile grid.",
    singleton: true,
  },
  [HomepageSectionType.newsletter]: {
    label: "Newsletter",
    description: "Email signup block.",
    singleton: true,
  },
  [HomepageSectionType.faq]: {
    label: "FAQ",
    description: "A curated set of FAQ items.",
    singleton: true,
  },
  [HomepageSectionType.rich_text]: {
    label: "Rich text",
    description: "A free-form rich-text content block.",
    singleton: false,
  },
};

/** Ordered list of section types for the add picker. */
export const SECTION_TYPE_OPTIONS = Object.values(HomepageSectionType);

/**
 * A short, human one-line summary of a section payload for the list row.
 * Defensive: payload is unknown JSON, so it reads keys optionally.
 */
export function summarizeSectionPayload(
  type: HomepageSectionType,
  payload: unknown,
): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  const str = (k: string): string | undefined =>
    typeof p[k] === "string" ? (p[k] as string) : undefined;

  switch (type) {
    case HomepageSectionType.hero:
      return str("headline") ?? "Hero banner";
    case HomepageSectionType.story:
    case HomepageSectionType.rich_text:
      return str("title") ?? "Rich text content";
    case HomepageSectionType.newsletter:
      return str("title") ?? "Email signup";
    default:
      return str("title") ?? SECTION_TYPE_META[type].label;
  }
}

// ───────────────────────────── CMS page catalogue ─────────────────────────────

/**
 * The fixed content/legal page set (doc 15 §7.1 / FR-19/FR-20). Slugs are chosen
 * from this reserved set (not free-typed) so they always map to a real route.
 * `legal` pages additionally surface the review gate (FR-37).
 */
export interface CmsPageDef {
  slug: string;
  name: string;
  legal: boolean;
  /** Whether the storefront route also has code-owned chrome (form/accordion). */
  hasChrome?: boolean;
}

export const CMS_PAGES: readonly CmsPageDef[] = [
  { slug: "about", name: "About / Our Story", legal: false },
  { slug: "contact", name: "Contact", legal: false, hasChrome: true },
  { slug: "faq", name: "FAQ intro", legal: false, hasChrome: true },
  { slug: "shipping-policy", name: "Shipping & Delivery", legal: true },
  { slug: "returns-and-refunds", name: "Cancellation & Refund", legal: true },
  { slug: "privacy-policy", name: "Privacy Policy", legal: true },
  { slug: "terms", name: "Terms & Conditions", legal: true },
  { slug: "care-guide", name: "Care Guide", legal: false },
  { slug: "bulk-orders", name: "Bulk / Corporate copy", legal: false, hasChrome: true },
] as const;

/** Reserved CMS slugs (for the slug picker + override guard). */
export const RESERVED_CMS_SLUGS: ReadonlySet<string> = new Set(CMS_PAGES.map((p) => p.slug));

export function cmsPageDef(slug: string): CmsPageDef | undefined {
  return CMS_PAGES.find((p) => p.slug === slug);
}

/** Slugs whose storefront route is `/faq` (so we also bust the `faq` tag). */
export const FAQ_PAGE_SLUG = "faq";

// ───────────────────────────── settings sections ─────────────────────────────

export const SETTINGS_SECTIONS = [
  { id: "store", label: "Store & Brand" },
  { id: "contact", label: "Contact & Social" },
  { id: "shipping", label: "Shipping" },
  { id: "tax", label: "Tax / Legal" },
  { id: "seo", label: "SEO Defaults" },
  { id: "announcement", label: "Announcement Bar" },
] as const;
