/**
 * PURE collection write-schemas (no DB, no `server-only`) — co-located with the
 * collection admin Server Actions and shared by the admin forms. Field
 * names/enums follow `prisma/schema.prisma` (`Collection`, `CollectionProduct`,
 * `CollectionType`) and docs/11 §3.10/§3.15 verbatim. Kept free of
 * `import "server-only"` so it is unit-testable.
 *
 * `slug` is optional on input (auto-derived from `title` in the action). The
 * automated `rules` shape is captured here for **V1** (docs/11 FR-40); MVP ships
 * the manual membership path and the automated recompute is a stub.
 */

import { z } from "zod";
import { CollectionType } from "@prisma/client";
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

// ───────────────────────────── automated rules (V1) ─────────────────────────────

/** Candidate fields an automated-collection condition can match on (FR-40). */
export const RULE_FIELDS = [
  "category",
  "tag",
  "occasion",
  "price",
  "isBestseller",
  "isFeatured",
] as const;

/** Comparison operators for a condition (FR-40). */
export const RULE_OPS = ["eq", "in", "lte", "gte"] as const;

/**
 * A single automated-collection condition. `value` is intentionally permissive
 * (string | number | boolean | string[]) — per-field/op coherence is enforced by
 * the (V1) rule engine, not the shape. Price values are integer **paise**.
 */
export const ruleConditionSchema = z.object({
  field: z.enum(RULE_FIELDS),
  op: z.enum(RULE_OPS),
  value: z.union([
    z.string().trim().min(1),
    z.number(),
    z.boolean(),
    z.array(z.string().trim().min(1)).min(1),
  ]),
});

export type RuleCondition = z.infer<typeof ruleConditionSchema>;

/** `Collection.rules` JSON (docs/11 FR-40). `match` is ALL/ANY across conditions. */
export const collectionRulesSchema = z.object({
  match: z.enum(["all", "any"]).default("all"),
  conditions: z.array(ruleConditionSchema).max(20).default([]),
});

export type CollectionRules = z.infer<typeof collectionRulesSchema>;

// ───────────────────────────── upsert ─────────────────────────────

/**
 * Authoritative validator for the collection create/edit form (docs/11 FR-60).
 * `slug` optional (auto from `title`). `rules` is only meaningful when
 * `type = automated`; the form omits it for manual collections.
 */
export const collectionInputSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1, "Title is required.").max(120),
    slug: slugSchema.optional(),
    description: optionalTrimmed(2000),
    heroImageId: z.string().trim().min(1).optional(),
    type: z.nativeEnum(CollectionType).default(CollectionType.manual),
    rules: collectionRulesSchema.optional(),
    sortOrder: z.coerce.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
    isFeaturedOnHome: z.boolean().default(false),
    metaTitle: optionalTrimmed(70),
    metaDescription: optionalTrimmed(200),
  })
  .superRefine((data, ctx) => {
    // An automated collection needs at least one rule to materialize members.
    if (
      data.type === CollectionType.automated &&
      (!data.rules || data.rules.conditions.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rules"],
        message: "Add at least one rule for an automated collection.",
      });
    }
  });

export type CollectionInput = z.infer<typeof collectionInputSchema>;

// ───────────────────────────── membership (manual) ─────────────────────────────

/**
 * Replace the manual membership set for a collection (docs/11 FR-61). `items`
 * carries the merchandising order; the action re-indexes `sortOrder` densely.
 */
export const setCollectionProductsSchema = z.object({
  collectionId: z.string().trim().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1),
        sortOrder: z.coerce.number().int().min(0),
      }),
    )
    .max(500),
});

export type SetCollectionProductsInput = z.infer<typeof setCollectionProductsSchema>;

// ───────────────────────────── reorder collections ─────────────────────────────

/** Reorder collections in the list (docs/11 FR-63). */
export const reorderCollectionsSchema = z.object({
  orders: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        sortOrder: z.coerce.number().int().min(0),
      }),
    )
    .min(1),
});

export type ReorderCollectionsInput = z.infer<typeof reorderCollectionsSchema>;

/** Delete a collection by id (docs/11 §6.3). */
export const deleteCollectionSchema = z.object({
  id: z.string().trim().min(1),
});

export type DeleteCollectionInput = z.infer<typeof deleteCollectionSchema>;
