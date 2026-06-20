"use server";

import { headers } from "next/headers";
import { createBulkInquiry, createContactMessage } from "@/lib/services/leads";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

/**
 * Lead-capture Server Actions for the storefront bulk-inquiry (`/bulk-orders`,
 * doc 05 §6.1) and contact (`/contact`, doc 15) forms.
 *
 * Both read raw `FormData`, delegate to the Phase-1 service functions
 * (`createBulkInquiry` / `createContactMessage`) which **re-validate with the
 * pure Zod schemas server-side (the source of truth — doc 05 FR-22) and reject a
 * filled honeypot**, then map the returned `ActionResult` to a flat, serialisable
 * `LeadFormState` for `useActionState` / `react-hook-form`.
 *
 * Abuse / bot defence (docs/16 §6.6, FR-23/FR-24): each submit is (1) per-IP
 * rate-limited (5 / 10 min — friendly fail, never throws) and (2) gated by
 * Cloudflare Turnstile via `verifyTurnstile` (a no-op when `TURNSTILE_SECRET_KEY`
 * is unset, so dev/preview keep working). The honeypot stays as a third layer in
 * the service.
 *
 * Money note (CANON §10): the bulk form collects budget in **₹**; the schema
 * field is `budgetRupees` (coerced from the raw string) and the service converts
 * it to integer paise on write — we forward the raw string and let Zod coerce.
 */

/** Flat result shape consumed by the client forms (`useActionState`). */
export interface LeadFormState {
  ok: boolean;
  /** Toast/banner copy (success or error). Empty before first submit. */
  message: string;
  /** Per-field server validation errors, keyed by schema field name. */
  fieldErrors?: Record<string, string[]>;
}

const GENERIC_ERROR = "Something went wrong. Please try again.";
const RATE_LIMITED = "You're sending these a little too fast. Please try again in a few minutes.";
/** Shown when Turnstile rejects the token (configured deployments only). */
const VERIFICATION_FAILED = "We couldn't verify your submission. Please try again.";

/** Public-form throttle: 5 submissions per 10 minutes, keyed by IP + form. */
const FORM_RATE = { limit: 5, windowMs: 10 * 60_000 };

/** Read a FormData value as a trimmed string (empty string when absent). */
function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Read an optional FormData value: returns `undefined` when the field is absent
 * or blank, so Zod `.optional()` fields stay unset rather than failing a coerce
 * (e.g. an empty `quantity`/`budget`/`deadline` must not become `NaN`/Invalid
 * Date).
 */
function optionalField(formData: FormData, name: string): string | undefined {
  const value = field(formData, name).trim();
  return value.length > 0 ? value : undefined;
}

// ───────────────────────────── bulk inquiry ─────────────────────────────

/**
 * `/bulk-orders` inquiry submit. Forwards to `createBulkInquiry`, which writes a
 * `BulkInquiry(status='new')` on success. Optional numeric/date fields are
 * omitted when blank so they validate as "not provided".
 */
export async function submitBulkInquiry(
  _prev: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const ip = clientIp(await headers());
  if (!rateLimit(`lead:bulk:${ip}`, FORM_RATE).ok) {
    return { ok: false, message: RATE_LIMITED };
  }
  // Cloudflare Turnstile (no-op when unconfigured). Bind to the caller IP.
  if (!(await verifyTurnstile(field(formData, "turnstileToken"), ip))) {
    return { ok: false, message: VERIFICATION_FAILED };
  }

  const res = await createBulkInquiry({
    name: field(formData, "name"),
    company: optionalField(formData, "company"),
    phone: field(formData, "phone"),
    email: field(formData, "email"),
    productInterest: optionalField(formData, "productInterest"),
    // Coerced to int by the schema; omit when blank.
    quantity: optionalField(formData, "quantity") as unknown as number | undefined,
    occasion: optionalField(formData, "occasion"),
    // Entered in ₹; the schema coerces `budgetRupees` and the service stores paise.
    budgetRupees: optionalField(formData, "budget") as unknown as number | undefined,
    // Coerced to a Date by the schema; omit when blank.
    deadline: optionalField(formData, "deadline") as unknown as Date | undefined,
    message: field(formData, "message"),
    website: field(formData, "website"), // honeypot — must stay empty
  });

  if (res.ok) {
    return {
      ok: true,
      message:
        "Thanks! We've received your inquiry and will reply within 1 business day.",
    };
  }

  return {
    ok: false,
    message: res.error || GENERIC_ERROR,
    fieldErrors: res.fieldErrors,
  };
}

// ───────────────────────────── contact message ─────────────────────────────

/**
 * `/contact` form submit. Forwards to `createContactMessage`, which writes a
 * `ContactMessage(status='new')` on success.
 */
export async function submitContact(
  _prev: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const ip = clientIp(await headers());
  if (!rateLimit(`lead:contact:${ip}`, FORM_RATE).ok) {
    return { ok: false, message: RATE_LIMITED };
  }
  // Cloudflare Turnstile (no-op when unconfigured). Bind to the caller IP.
  if (!(await verifyTurnstile(field(formData, "turnstileToken"), ip))) {
    return { ok: false, message: VERIFICATION_FAILED };
  }

  const res = await createContactMessage({
    name: field(formData, "name"),
    email: field(formData, "email"),
    phone: optionalField(formData, "phone"),
    subject: optionalField(formData, "subject"),
    message: field(formData, "message"),
    website: field(formData, "website"), // honeypot — must stay empty
  });

  if (res.ok) {
    return {
      ok: true,
      message: "Thanks for reaching out! We'll get back to you soon.",
    };
  }

  return {
    ok: false,
    message: res.error || GENERIC_ERROR,
    fieldErrors: res.fieldErrors,
  };
}
