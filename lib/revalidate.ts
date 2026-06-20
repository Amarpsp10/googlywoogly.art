import "server-only";
import { revalidateTag, revalidatePath } from "next/cache";
import { cacheTags } from "./cache-tags";

/**
 * On-demand revalidation helpers (CANON §9). Admin mutations call these so the
 * storefront reflects changes immediately instead of waiting for the time-based
 * safety-net revalidation.
 *
 * IMPORTANT: the catalog read layer (`lib/services/*`) issues plain Prisma
 * queries that are NOT registered in the Next data cache, so `revalidateTag`
 * alone can't invalidate the ISR/static routes that render them (`/`, the PDP,
 * `/sitemap.xml`). We therefore ALSO `revalidatePath` those routes by path — the
 * tags are kept for when/if the reads are migrated to a tagged cache. Dynamic
 * routes (`/products`, `/category/[slug]`, `/collections/[slug]`) render per
 * request and need no revalidation.
 *
 * Next.js 16 requires a cache-profile as the 2nd arg to `revalidateTag`; `"max"`
 * is the documented drop-in for the old single-arg behavior.
 */
const PROFILE = "max";

function bust(...tags: string[]): void {
  for (const tag of tags) revalidateTag(tag, PROFILE);
}

export function revalidateProduct(slug: string): void {
  bust(cacheTags.product(slug), cacheTags.products);
  revalidatePath(`/products/${slug}`); // PDP (ISR) — tag is inert, so revalidate by path
}

export function revalidateCatalog(): void {
  bust(cacheTags.products);
  revalidateSitemap();
}

export function revalidateCategory(slug: string): void {
  bust(cacheTags.category(slug), cacheTags.products, cacheTags.nav);
  revalidatePath(`/category/${slug}`);
  revalidatePath("/"); // the landing renders the category grid
  revalidateSitemap(); // a category add/remove/rename changes sitemap URLs
}

export function revalidateCollection(slug: string): void {
  bust(cacheTags.collection(slug), cacheTags.products);
  revalidatePath(`/collections/${slug}`);
  revalidateSitemap();
}

export function revalidateHome(): void {
  bust(cacheTags.home, cacheTags.banners);
  revalidatePath("/"); // landing (ISR) — renders categories + featured products
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

/**
 * Revalidate the XML sitemap (a static route). Call on any catalog change that
 * adds, removes, or renames a product / category / collection URL so search
 * engines see the new URL set without waiting for a redeploy.
 */
export function revalidateSitemap(): void {
  revalidatePath("/sitemap.xml");
}
