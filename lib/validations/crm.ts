import { z } from "zod";
import {
  InquiryStatus,
  ContactStatus,
  ReviewStatus,
} from "@prisma/client";

/**
 * Admin write-schemas for the Leads / CRM surface (docs/12 leads, docs/15) —
 * PURE (no DB, no `server-only`): used by the colocated Server Actions and unit
 * tests alike. Names/fields/enums follow CANON §5/§6 + `prisma/schema.prisma`
 * verbatim. The server is the source of truth: each action re-validates with
 * these schemas before writing (doc 10 §5.4 "inputs are Zod-validated").
 *
 * These cover the four CRM mutations:
 *  - `updateBulkInquiry`   → `BulkInquiry` status pipeline / assignee / notes
 *  - `updateContactMessage`→ `ContactMessage` status
 *  - `updateCustomerCrm`   → `Customer` tags / notes
 *  - `moderateReview`      → `Review` approve / reject (V1)
 */

/** A non-empty cuid id (entity reference posted from a form). */
const idSchema = z.string().trim().min(1, "Missing id.");

/** Free-form admin-only note body (internal — never customer-visible). */
const internalNotesSchema = z
  .string()
  .trim()
  .max(5000, "Notes are too long (max 5000 characters).")
  .optional();

// ───────────────────────────── bulk inquiry ─────────────────────────────

/**
 * Update a bulk inquiry's pipeline status, assignee, and internal notes
 * (doc 12 leads). `status` is the `InquiryStatus` enum; `assignedToAdminId` is
 * an optional `AdminUser` id (empty string ⇒ unassign → null); `internalNotes`
 * is admin-only free text. Existence of the assignee is verified in the action.
 */
export const updateBulkInquirySchema = z.object({
  id: idSchema,
  status: z.nativeEnum(InquiryStatus),
  /** Empty string means "unassign" (stored as null). */
  assignedToAdminId: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  internalNotes: internalNotesSchema,
});

export type UpdateBulkInquiryInput = z.infer<typeof updateBulkInquirySchema>;

// ───────────────────────────── contact message ─────────────────────────────

/**
 * Update a contact message's status (doc 12 leads, `ContactStatus`). Replies go
 * out via the founder's mail client (a `mailto:` link on the detail) — the admin
 * just records the resulting state (new → read → replied → archived).
 */
export const updateContactMessageSchema = z.object({
  id: idSchema,
  status: z.nativeEnum(ContactStatus),
});

export type UpdateContactMessageInput = z.infer<
  typeof updateContactMessageSchema
>;

// ───────────────────────────── customer CRM ─────────────────────────────

/** A single CRM tag — short, trimmed, non-empty. */
const tagSchema = z
  .string()
  .trim()
  .min(1)
  .max(32, "Each tag must be 32 characters or fewer.");

/**
 * Update a `Customer`'s CRM fields — `tags` and `notes` only (doc 12 §5.2: the
 * `Customer` row's counters are owned by order placement and are NOT writable
 * here). Tags accept either a real string[] or a comma-separated string from a
 * plain form field; both are normalised to a de-duplicated, capped list.
 */
export const updateCustomerCrmSchema = z.object({
  id: idSchema,
  tags: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((value) => {
      const raw = Array.isArray(value)
        ? value
        : typeof value === "string"
          ? value.split(",")
          : [];
      const cleaned: string[] = [];
      const seen = new Set<string>();
      for (const part of raw) {
        const parsed = tagSchema.safeParse(part);
        if (!parsed.success) continue;
        const key = parsed.data.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        cleaned.push(parsed.data);
        if (cleaned.length >= 20) break; // cap to keep the chip row sane
      }
      return cleaned;
    }),
  notes: z
    .string()
    .trim()
    .max(5000, "Notes are too long (max 5000 characters).")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type UpdateCustomerCrmInput = z.infer<typeof updateCustomerCrmSchema>;

// ───────────────────────────── review moderation ─────────────────────────────

/**
 * Moderate a product `Review` (V1): approve or reject (doc 10 FR-45
 * `review.moderate`). Only the two terminal moderation decisions are accepted
 * from the queue — `pending` is not a settable target. An approval flips the
 * review to `approved` (it then renders on the PDP); a rejection hides it.
 */
export const moderateReviewSchema = z.object({
  id: idSchema,
  decision: z.enum([ReviewStatus.approved, ReviewStatus.rejected], {
    errorMap: () => ({ message: "Choose approve or reject." }),
  }),
});

export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;
