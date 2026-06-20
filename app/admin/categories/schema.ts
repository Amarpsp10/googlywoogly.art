/**
 * PURE category write-schemas (no DB, no `server-only`) — co-located with the
 * category admin Server Actions and shared by the admin forms. Field names/enums
 * follow `prisma/schema.prisma` (`Category`) and docs/11 §3.14 (FR-56/57)
 * verbatim. Kept free of `import "server-only"` so it is unit-testable.
 *
 * The slug is **optional on input**: the action auto-derives a unique slug from
 * `name` when omitted (docs/11 FR-56). `parentId` depth (one level) is enforced
 * in the action where the DB context lives — the schema only shapes the input.
 */

import { z } from "zod";
import { slugSchema } from "@/lib/validations/catalog";

/** Trim a string, turning blank → undefined (so optional fields stay unset). */
const optionalTrimmed = (max: number) =>
  z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const t = v.trim();
      return t.length ? t : undefined;
    },
    z.string().max(max).optional(),
  );

/**
 * Authoritative validator for the category create/edit form (docs/11 FR-56).
 * `slug` is optional (auto from `name` when blank). SEO meta lengths follow the
 * project's other forms (≤ 70 title / ≤ 200 description).
 */
export const categoryInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, "Name is required.").max(80),
  /** Optional — auto-derived from `name` in the action when omitted. */
  slug: slugSchema.optional(),
  description: optionalTrimmed(2000),
  imageId: z.string().trim().min(1).optional(),
  /** A top-level parent category id (depth = 1, app-enforced in the action). */
  parentId: z.string().trim().min(1).optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  metaTitle: optionalTrimmed(70),
  metaDescription: optionalTrimmed(200),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

/** Reorder payload: dense `sortOrder` (+ optional reparent) per row (docs/11 FR-57/59). */
export const reorderCategoriesSchema = z.object({
  orders: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        sortOrder: z.coerce.number().int().min(0),
        parentId: z.string().trim().min(1).nullish(),
      }),
    )
    .min(1),
});

export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;

/** Delete payload: optionally reassign attached products to another category (docs/11 FR-58). */
export const deleteCategorySchema = z.object({
  id: z.string().trim().min(1),
  reassignToId: z.string().trim().min(1).optional(),
});

export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>;
