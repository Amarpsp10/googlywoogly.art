import "server-only";
import { revalidateTag } from "next/cache";
import { cacheTags } from "./cache-tags";

/**
 * On-demand revalidation helpers (CANON §9). Admin mutations call these so the
 * storefront reflects changes immediately instead of waiting for the time-based
 * safety-net revalidation. Each helper busts exactly the tags a change affects.
 *
 * Next.js 16 requires a cache-profile as the 2nd arg to `revalidateTag`; `"max"`
 * is the documented drop-in for the old single-arg behavior (immediate purge).
 * See https://nextjs.org/docs/messages/revalidate-tag-single-arg
 */
const PROFILE = "max";

function bust(...tags: string[]): void {
  for (const tag of tags) revalidateTag(tag, PROFILE);
}

export function revalidateProduct(slug: string): void {
  bust(cacheTags.product(slug), cacheTags.products);
}

export function revalidateCatalog(): void {
  bust(cacheTags.products);
}

export function revalidateCategory(slug: string): void {
  bust(cacheTags.category(slug), cacheTags.products, cacheTags.nav);
}

export function revalidateCollection(slug: string): void {
  bust(cacheTags.collection(slug), cacheTags.products);
}

export function revalidateHome(): void {
  bust(cacheTags.home, cacheTags.banners);
}

export function revalidateSettings(): void {
  bust(cacheTags.settings, cacheTags.nav);
}

export function revalidateContentPage(slug: string): void {
  bust(cacheTags.page(slug));
}

export function revalidateFaq(): void {
  bust(cacheTags.faq);
}

export function revalidateTestimonials(): void {
  bust(cacheTags.testimonials, cacheTags.home);
}
