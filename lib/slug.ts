/**
 * Slug helpers. Slugs are lowercase, kebab-case, ASCII, used in storefront URLs
 * (never raw DB ids). See CANON §10.
 */

/** Produce a URL-safe kebab-case slug from arbitrary text. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics -> hyphen
    .replace(/-{2,}/g, "-") // collapse repeats
    .replace(/^-+|-+$/g, ""); // trim hyphens
}

/**
 * Given a base string and a predicate that tells whether a candidate slug is
 * already taken, return a unique slug (`base`, `base-2`, `base-3`, …).
 * `ignoreSlug` lets an entity keep its own slug on update.
 */
export async function uniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
  ignoreSlug?: string,
): Promise<string> {
  const root = slugify(base) || "item";
  let candidate = root;
  let n = 2;
  while (candidate !== ignoreSlug && (await isTaken(candidate))) {
    candidate = `${root}-${n}`;
    n += 1;
  }
  return candidate;
}
