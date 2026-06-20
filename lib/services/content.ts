import "server-only";

import { cache } from "react";
import { Prisma, type BannerType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  categorySelect,
  collectionSelect,
  type CategoryListItem,
  type CollectionListItem,
} from "@/lib/services/select";

/**
 * Content/CMS storefront reads (doc 05 §5.1, doc 15 §5.3). These are plain async
 * functions called by RSC/route handlers; cross-request freshness comes from the
 * CANON §9 cache tags (`home`, `banners`, `testimonials`, `faq`, `page:{slug}`,
 * `nav`) busted on admin save. Within a single render they are React-`cache`
 * deduped where a surface may read the same data more than once.
 */

// ───────────────────────────── homepage sections ─────────────────────────────

const homepageSectionSelect = {
  id: true,
  key: true,
  type: true,
  payload: true,
  sortOrder: true,
} satisfies Prisma.HomepageSectionSelect;

export type HomepageSectionRow = Prisma.HomepageSectionGetPayload<{
  select: typeof homepageSectionSelect;
}>;

/**
 * Active homepage sections, ascending by `sortOrder` then `key` (doc 05 FR-2/FR-8
 * stable tie-break). The renderer validates each `payload` against the
 * discriminated union and skips invalid/empty ones (doc 05 §7).
 */
export const getHomepageSections = cache(
  async (): Promise<HomepageSectionRow[]> => {
    return prisma.homepageSection.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
      select: homepageSectionSelect,
    });
  },
);

/** Editable hero copy from the active `hero` homepage section. */
export interface HeroContent {
  headline?: string;
  sub?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

/**
 * The landing hero's editable copy (Content → Homepage → Hero). Returns null when
 * there's no active hero section or no usable fields, so the landing keeps its
 * default design. Reads the `payload` JSON (validated on write by `heroPayload`).
 */
export async function getHeroContent(): Promise<HeroContent | null> {
  const section = await prisma.homepageSection.findFirst({
    where: { type: "hero", isActive: true },
    select: { payload: true },
  });
  const p = section?.payload;
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const row = p as Record<string, unknown>;
  const str = (v: unknown) =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
  const content: HeroContent = {
    headline: str(row.headline),
    sub: str(row.sub),
    ctaLabel: str(row.ctaLabel),
    ctaHref: str(row.ctaHref),
  };
  return content.headline || content.sub || content.ctaLabel || content.ctaHref
    ? content
    : null;
}

// ───────────────────────────── banners ─────────────────────────────

const bannerSelect = {
  id: true,
  type: true,
  text: true,
  link: true,
  sortOrder: true,
  startsAt: true,
  endsAt: true,
  image: { select: { url: true, alt: true, width: true, height: true } },
} satisfies Prisma.BannerSelect;

export type BannerRow = Prisma.BannerGetPayload<{ select: typeof bannerSelect }>;

/**
 * Live banners, optionally filtered by `type` (doc 15 FR-10). A banner is live
 * when `isActive=true` AND now ∈ [startsAt, endsAt] (open-ended when a bound is
 * null). Ordered by `sortOrder` for marquee concatenation / hero precedence.
 */
export async function getActiveBanners(type?: BannerType): Promise<BannerRow[]> {
  const now = new Date();
  return prisma.banner.findMany({
    where: {
      isActive: true,
      ...(type ? { type } : {}),
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { sortOrder: "asc" },
    select: bannerSelect,
  });
}

// ───────────────────────────── testimonials ─────────────────────────────

const testimonialSelect = {
  id: true,
  customerName: true,
  location: true,
  rating: true,
  text: true,
  isFeatured: true,
  image: { select: { url: true, alt: true, width: true, height: true } },
} satisfies Prisma.TestimonialSelect;

export type TestimonialRow = Prisma.TestimonialGetPayload<{
  select: typeof testimonialSelect;
}>;

/**
 * Approved, featured testimonials for the homepage subset (doc 05 FR-8): only
 * `isApproved=true AND isFeatured=true`, ordered by `sortOrder`. `limit` caps the
 * carousel (default 6).
 */
export async function getFeaturedTestimonials(limit = 6): Promise<TestimonialRow[]> {
  return prisma.testimonial.findMany({
    where: { isApproved: true, isFeatured: true },
    orderBy: { sortOrder: "asc" },
    take: limit,
    select: testimonialSelect,
  });
}

/** All approved testimonials (e.g. a future reviews/social-proof page). */
export async function getApprovedTestimonials(limit = 24): Promise<TestimonialRow[]> {
  return prisma.testimonial.findMany({
    where: { isApproved: true },
    orderBy: { sortOrder: "asc" },
    take: limit,
    select: testimonialSelect,
  });
}

// ───────────────────────────── FAQs ─────────────────────────────

const faqSelect = {
  id: true,
  question: true,
  answer: true,
  category: true,
} satisfies Prisma.FaqItemSelect;

export type FaqRow = Prisma.FaqItemGetPayload<{ select: typeof faqSelect }>;

/** A `category` heading with its ordered published items. */
export interface FaqGroup {
  category: string;
  items: FaqRow[];
}

/**
 * Published FAQs grouped by `category`, items ordered by `sortOrder` within each
 * group (doc 15 FR-16; `/faq` renders these + emits `FAQPage` JSON-LD).
 *
 * Items are fetched ordered by `(sortOrder, category)`; a group appears in the
 * order its first (lowest-`sortOrder`) item is encountered, so the founder
 * controls section order via item `sortOrder`. Uncategorised items collect into a
 * "General" group, pushed to the end for a tidy reading order.
 */
export async function getPublishedFaqs(): Promise<FaqGroup[]> {
  const items = await prisma.faqItem.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { category: "asc" }],
    select: faqSelect,
  });

  const groups: FaqGroup[] = [];
  const byCategory = new Map<string, FaqGroup>();

  for (const item of items) {
    const category = item.category?.trim() || "General";
    let group = byCategory.get(category);
    if (!group) {
      group = { category, items: [] };
      byCategory.set(category, group);
      groups.push(group);
    }
    group.items.push(item);
  }

  // Keep a "General" group (if any) last.
  groups.sort((a, b) => {
    if (a.category === "General") return 1;
    if (b.category === "General") return -1;
    return 0;
  });

  return groups;
}

// ───────────────────────────── CMS page ─────────────────────────────

const cmsPageSelect = {
  id: true,
  slug: true,
  title: true,
  bodyRich: true,
  metaTitle: true,
  metaDescription: true,
  lastReviewedAt: true,
  updatedAt: true,
} satisfies Prisma.CmsPageSelect;

export type CmsPageRow = Prisma.CmsPageGetPayload<{ select: typeof cmsPageSelect }>;

/**
 * A published CMS page by slug (doc 15 FR-19/FR-21). Returns `null` when the page
 * does not exist or is unpublished — the route then renders the code-default
 * fallback body (so legal pages never 404; doc 15 FR-21).
 */
export async function getCmsPage(slug: string): Promise<CmsPageRow | null> {
  return prisma.cmsPage.findFirst({
    where: { slug, isPublished: true },
    select: cmsPageSelect,
  });
}

// ───────────────────────────── navigation ─────────────────────────────

export interface NavData {
  categories: CategoryListItem[];
  collections: CollectionListItem[];
}

/**
 * Header/footer navigation data (doc 05 §5.1, tag `nav`): active top-level
 * categories and active collections, both ordered by `sortOrder`. Request-deduped
 * since header and footer both consume it.
 */
export const getNavData = cache(async (): Promise<NavData> => {
  const [categories, collections] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { sortOrder: "asc" },
      select: categorySelect,
    }),
    prisma.collection.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: collectionSelect,
    }),
  ]);
  return { categories, collections };
});
