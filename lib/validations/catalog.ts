import { z } from "zod";
import { rupeesToPaise } from "@/lib/money";

/**
 * PURE catalog validation/parsing (no DB, no `server-only`).
 *
 * Two responsibilities:
 *  1. `productFilterParamsSchema` — coerce a `URLSearchParams`-like record into a
 *     typed, defaulted, capped filter/sort/pagination object for the storefront
 *     PLP/category/collection/search grids (docs/06 §3.5 query-param contract).
 *     It NEVER throws on bad input: unknown/invalid values are dropped and
 *     coerced to sane defaults so a crafted URL can't 500 the page.
 *  2. `adminProductInputSchema` — authoritative validation of the editable
 *     `Product` fields for admin create/update (docs/11). Money is integer
 *     **paise** here: the form coerces ₹ → paise before calling (docs/11 FR-3).
 *
 * Reused by RSC pages (parse `searchParams`), Server Actions (re-validate), and
 * unit tests. Kept free of `import "server-only"` so it is importable in tests.
 */

// ───────────────────────────── filter param contract ─────────────────────────────

/** Catalog sort keys (docs/06 FR-15). `featured` is the storefront default. */
export const CATALOG_SORTS = [
  "featured",
  "newest",
  "price_asc",
  "price_desc",
  "bestselling",
] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

/** Availability facet values = the derived `InventoryState` enum (docs/06 FR-10). */
export const AVAILABILITY_VALUES = [
  "in_stock",
  "low_stock",
  "out_of_stock",
  "made_to_order",
] as const;
export type AvailabilityValue = (typeof AVAILABILITY_VALUES)[number];

/**
 * Curated `material:*` tag namespace backing the material facet (docs/06 FR-9).
 * URLs carry the bare key (`material=wood,brass`); the service prefixes
 * `material:` when querying `Product.tags`.
 */
export const MATERIAL_VALUES = [
  "wood",
  "ceramic",
  "brass",
  "resin",
  "fabric",
  "metal",
  "glass",
  "paper",
] as const;
export type MaterialValue = (typeof MATERIAL_VALUES)[number];

/** Default page size for catalog grids (docs/06 FR-20). */
export const DEFAULT_PER_PAGE = 24;
/** Hard cap on page size (docs/06 — bound payload/latency). */
export const MAX_PER_PAGE = 48;

/** A `URLSearchParams`-like record: the shape Next.js hands a page's `searchParams`. */
export type RawSearchParams = Record<
  string,
  string | string[] | undefined
>;

/** Take the first value when a param arrives repeated (`?sort=a&sort=b` → `a`). */
function firstValue(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

/**
 * Normalize a comma-separated multi-value facet param into a clean string list:
 * split on commas (and repeated params), trim, lowercase, drop empties,
 * de-duplicate, and sort — so `mugs,Coasters` and `coasters,mugs` canonicalize
 * identically (docs/06 FR-25).
 */
function parseMultiCsv(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  const parts = (Array.isArray(v) ? v : [v]).flatMap((s) => s.split(","));
  const cleaned = parts
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  return Array.from(new Set(cleaned)).sort();
}

/** A non-empty, slug-ish list from a CSV multi-param (kept generic — slugs/keys). */
const csvList = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform(parseMultiCsv);

/** Restrict a parsed CSV list to a known vocabulary, preserving sorted order. */
function restrictTo<T extends readonly string[]>(allowed: T) {
  const set = new Set<string>(allowed);
  return z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) =>
      parseMultiCsv(v).filter((x): x is T[number] => set.has(x)),
    );
}

/**
 * Parse the `price` facet. Accepts either the canonical combined form
 * `price=min-max` (whole **rupees**, inclusive, open-ended `500-` / `-1500`
 * allowed — docs/06 FR-8) OR discrete numeric `priceMin`/`priceMax` params.
 * Combined `price` wins when present. Inverted/invalid ranges are stripped.
 * Output is **paise**.
 */
function parsePrice(raw: RawSearchParams): {
  priceMin?: number;
  priceMax?: number;
} {
  const toRupees = (s: string | undefined): number | undefined => {
    if (s === undefined) return undefined;
    const t = s.trim();
    if (t === "") return undefined;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return n;
  };

  let minR: number | undefined;
  let maxR: number | undefined;

  const combined = firstValue(raw.price);
  if (combined && combined.includes("-")) {
    const idx = combined.indexOf("-");
    minR = toRupees(combined.slice(0, idx));
    maxR = toRupees(combined.slice(idx + 1));
  } else {
    minR = toRupees(firstValue(raw.priceMin));
    maxR = toRupees(firstValue(raw.priceMax));
  }

  // Drop inverted ranges (min > max) entirely (docs/06 FR-8).
  if (minR !== undefined && maxR !== undefined && minR > maxR) {
    return {};
  }

  const out: { priceMin?: number; priceMax?: number } = {};
  if (minR !== undefined) out.priceMin = rupeesToPaise(minR);
  if (maxR !== undefined) out.priceMax = rupeesToPaise(maxR);
  return out;
}

const sortSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    const s = firstValue(v);
    return (CATALOG_SORTS as readonly string[]).includes(s ?? "")
      ? (s as CatalogSort)
      : "featured";
  });

const pageSchema = z
  .union([z.string(), z.array(z.string()), z.number()])
  .optional()
  .transform((v) => {
    const raw = typeof v === "number" ? v : firstValue(v as string | string[]);
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.floor(n);
  });

const perPageSchema = z
  .union([z.string(), z.array(z.string()), z.number()])
  .optional()
  .transform((v) => {
    const raw = typeof v === "number" ? v : firstValue(v as string | string[]);
    if (raw === undefined || raw === null || raw === "") return DEFAULT_PER_PAGE;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return DEFAULT_PER_PAGE;
    return Math.min(MAX_PER_PAGE, Math.floor(n));
  });

/**
 * Parse a `URLSearchParams`-like record into the validated catalog filter input.
 * Total function: always succeeds, dropping anything it doesn't recognize.
 */
export const productFilterParamsSchema = z
  .record(z.union([z.string(), z.array(z.string())]).optional())
  .transform((raw) => {
    const r = raw as RawSearchParams;
    const { priceMin, priceMax } = parsePrice(r);
    return {
      category: parseMultiCsv(r.category),
      collection: parseMultiCsv(r.collection),
      occasion: parseMultiCsv(r.occasion),
      material: restrictTo(MATERIAL_VALUES).parse(r.material),
      availability: restrictTo(AVAILABILITY_VALUES).parse(r.availability),
      tag: parseMultiCsv(r.tag),
      priceMin,
      priceMax,
      sort: sortSchema.parse(r.sort),
      page: pageSchema.parse(r.page),
      perPage: perPageSchema.parse(r.perPage),
    };
  });

/** Validated, normalized catalog filter/sort/pagination input. */
export type ProductFilterParams = z.infer<typeof productFilterParamsSchema>;

/** Convenience wrapper: parse raw `searchParams` into typed filters (never throws). */
export function parseProductFilters(
  raw: RawSearchParams | undefined,
): ProductFilterParams {
  return productFilterParamsSchema.parse(raw ?? {});
}

// ───────────────────────────── admin product input ─────────────────────────────

/** Slug grammar: lowercase kebab-case ASCII (CANON §10). */
export const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required.")
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single hyphens.",
  );

/** A non-negative integer amount in paise. */
const paiseInt = z
  .number({ invalid_type_error: "Enter a valid amount." })
  .int("Amount must be a whole number of paise.")
  .min(0, "Amount cannot be negative.");

/** `Product.dimensions` JSON shape (CANON §3.5; `types/Dimensions`). */
export const dimensionsSchema = z.object({
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  diameter: z.number().positive().optional(),
  unit: z.enum(["cm", "in"]).default("cm"),
});

/** A free-form tag/occasion token: trimmed, lowercased, non-empty. */
const tagToken = z
  .string()
  .trim()
  .min(1)
  .transform((s) => s.toLowerCase());

const occasionToken = z.string().trim().min(1);

/**
 * Authoritative validator for the admin product editor (docs/11 §6.1).
 * Mirrors the editable `Product` fields verbatim; money is **paise**.
 *
 * The base schema enforces invariants that hold for *any* save (draft included):
 * non-empty slug/sku, `price >= 0`, and `compareAtPrice > price` when set
 * (docs/11 FR-19). The stricter *publish* checklist (price > 0, ≥1 image,
 * category present, MTO lead time — docs/11 FR-4) is enforced in the action,
 * which has the media/category context the pure schema does not.
 */
export const adminProductInputSchema = z
  .object({
    // Basics
    title: z.string().trim().min(1, "Title is required.").max(120),
    subtitle: z.string().trim().max(120).optional(),
    slug: slugSchema,
    description: z.string().trim().default(""),
    shortDescription: z.string().trim().max(200).optional(),
    sku: z.string().trim().min(1, "SKU is required.").max(64),

    // Pricing (paise)
    price: paiseInt,
    compareAtPrice: paiseInt.optional(),
    costPrice: paiseInt.optional(),

    // Status
    status: z.enum(["draft", "active", "archived"]).default("draft"),

    // Inventory
    inventoryQuantity: z.number().int().min(0).default(0),
    madeToOrder: z.boolean().default(false),
    productionLeadTimeDays: z.number().int().min(1).optional(),
    lowStockThreshold: z.number().int().min(0).default(3),

    // Personalization
    allowsPersonalization: z.boolean().default(false),
    personalizationLabel: z.string().trim().max(80).optional(),

    // Attributes
    materials: z.string().trim().max(200).optional(),
    careInstructions: z.string().trim().optional(),
    dimensions: dimensionsSchema.optional(),
    weightGrams: z.number().int().min(0).optional(),

    // Organization
    categoryId: z.string().trim().min(1).optional(),
    collectionIds: z.array(z.string().trim().min(1)).default([]),
    tags: z.array(tagToken).default([]),
    occasions: z.array(occasionToken).default([]),
    isFeatured: z.boolean().default(false),
    isBestseller: z.boolean().default(false),

    // SEO / media
    metaTitle: z.string().trim().max(70).optional(),
    metaDescription: z.string().trim().max(200).optional(),
    ogImageId: z.string().trim().min(1).optional(),
    primaryImageId: z.string().trim().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    // compareAtPrice must be strictly greater than price when set (docs/11 FR-19).
    if (
      data.compareAtPrice !== undefined &&
      data.compareAtPrice <= data.price
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["compareAtPrice"],
        message: "Compare-at price must be greater than the price.",
      });
    }
    // Made-to-order requires a lead time (docs/11 FR-4/FR-21).
    if (data.madeToOrder && data.productionLeadTimeDays === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["productionLeadTimeDays"],
        message: "Made-to-order products need a production lead time.",
      });
    }
  })
  // De-duplicate tag/occasion arrays after per-item normalization.
  .transform((data) => ({
    ...data,
    tags: Array.from(new Set(data.tags)),
    occasions: Array.from(new Set(data.occasions)),
    collectionIds: Array.from(new Set(data.collectionIds)),
  }));

/** Validated admin product input (paise money; deduped arrays). */
export type AdminProductInput = z.infer<typeof adminProductInputSchema>;
