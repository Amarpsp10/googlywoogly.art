/**
 * Canonical Next.js cache-tag builders (CANON §9). Pure strings — safe to import
 * anywhere. On-demand revalidation helpers that call `revalidateTag` live in
 * server-only modules; this file only constructs the tag names so storefront
 * reads and admin writes agree on the exact same keys.
 */

export const cacheTags = {
  /** Collection of all products (PLP, search, sitemaps). */
  products: "products",
  product: (slug: string) => `product:${slug}`,
  category: (slug: string) => `category:${slug}`,
  collection: (slug: string) => `collection:${slug}`,
  /** Homepage composition. */
  home: "home",
  banners: "banners",
  /** Global site settings (store name, socials, shipping defaults). */
  settings: "settings",
  /** Header/footer navigation (categories + collections). */
  nav: "nav",
  faq: "faq",
  testimonials: "testimonials",
  /** A CMS / legal page by slug. */
  page: (slug: string) => `page:${slug}`,
} as const;

export type CacheTag = string;
