import { z } from "zod";
import {
  emailSchema,
  phoneSchema,
  honeypotSchema,
} from "@/lib/validations/common";

/**
 * Lead-capture validation schemas (PURE — no DB, no `server-only`).
 *
 * Backs the storefront bulk-inquiry form (`05`), the contact form, and the
 * newsletter signup (`05` FR-10). The service layer (`lib/services/leads.ts`)
 * re-validates with these same schemas — the server is the source of truth
 * (`05` FR-22). Money is integer paise (CANON §10): `budgetRupees` is collected
 * in ₹ here and converted to paise in the service before persistence.
 *
 * Every form carries a `website` honeypot (must be empty) as a spam trap
 * (CANON §16.6); Turnstile is verified separately in the action layer.
 */

/** Reusable name field for lead forms. */
const leadNameSchema = z
  .string()
  .trim()
  .min(2, "Please enter your name.")
  .max(80, "Name is too long.");

/** Free-form message body shared by bulk + contact forms. */
const leadMessageSchema = z
  .string()
  .trim()
  .min(5, "Please add a short message.")
  .max(2000, "Message is too long.");

// ───────────────────────────── bulk inquiry ─────────────────────────────

/**
 * Corporate / bulk gifting inquiry → `BulkInquiry` (CANON §5).
 * Maps 1:1 to the schema fields; `budgetRupees` is the ₹ UI value (the service
 * stores it as `budget` in paise). `deadline` must not be in the past.
 */
export const bulkInquirySchema = z.object({
  name: leadNameSchema,
  company: z.string().trim().max(120, "Company name is too long.").optional(),
  phone: phoneSchema,
  email: emailSchema,
  productInterest: z
    .string()
    .trim()
    .max(200, "Please keep this under 200 characters.")
    .optional(),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(100000, "That quantity is unusually large — please contact us.")
    .optional(),
  occasion: z.string().trim().max(80, "Occasion is too long.").optional(),
  // Collected in rupees in the UI; converted to integer paise in the service.
  budgetRupees: z.coerce
    .number()
    .nonnegative("Budget cannot be negative.")
    .max(100000000, "Please enter a realistic budget.")
    .optional(),
  deadline: z.coerce
    .date()
    .refine((d) => !Number.isNaN(d.getTime()), "Enter a valid date.")
    .optional(),
  message: leadMessageSchema,
  /** Honeypot — must be empty (spam trap). */
  website: honeypotSchema,
  /** Cloudflare Turnstile token, verified in the action layer (CANON §16.6). */
  turnstileToken: z.string().optional(),
});

export type BulkInquiryInput = z.infer<typeof bulkInquirySchema>;

// ───────────────────────────── contact message ─────────────────────────────

/** General contact form → `ContactMessage` (CANON §5). */
export const contactSchema = z.object({
  name: leadNameSchema,
  email: emailSchema,
  phone: phoneSchema.optional(),
  subject: z.string().trim().max(150, "Subject is too long.").optional(),
  message: leadMessageSchema,
  /** Honeypot — must be empty (spam trap). */
  website: honeypotSchema,
  /** Cloudflare Turnstile token, verified in the action layer. */
  turnstileToken: z.string().optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

// ───────────────────────────── newsletter ─────────────────────────────

/**
 * Newsletter signup → `NewsletterSubscriber` (CANON §5, `05` FR-10).
 * `source` is the capture point; it is validated/normalised against the
 * `SubscriberSource` enum in the service (kept loose here so the same schema
 * works client-side without importing Prisma).
 */
export const newsletterSchema = z.object({
  email: emailSchema,
  source: z.string().trim().optional(),
  /** Honeypot — must be empty (spam trap). */
  website: honeypotSchema,
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;
