import "server-only";

import {
  Prisma,
  InquiryStatus,
  ContactStatus,
  SubscriberSource,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { rupeesToPaise } from "@/lib/money";
import { ok, fail, failValidation, type ActionResult } from "@/lib/result";
import {
  bulkInquirySchema,
  contactSchema,
  newsletterSchema,
  type BulkInquiryInput,
  type ContactInput,
  type NewsletterInput,
} from "@/lib/validations/leads";

/**
 * Lead-capture services: bulk inquiry, contact message, newsletter signup,
 * plus the admin list reads (CANON §5 — `BulkInquiry` / `ContactMessage` /
 * `NewsletterSubscriber`; `05` FR-17/18, FR-10).
 *
 * The three `create*`/`subscribe*` functions are the storefront write path:
 * they re-validate with the pure Zod schemas (server is the source of truth —
 * `05` FR-22), reject filled honeypots, and return an `ActionResult` so the
 * calling Server Action never throws across the boundary. They are plain async
 * library functions (no `"use server"`): the action wrappers add Turnstile,
 * rate-limiting, analytics events, and notifications (`05`/`13`/`14`).
 *
 * Money is integer paise (CANON §10): the bulk form collects `budgetRupees`
 * in ₹ and we persist `budget` in paise.
 */

const SPAM_REJECTION = "Your submission could not be processed.";

/** A filled honeypot ⇒ silently fail (do not reveal the trap to bots). */
function honeypotTripped(website: string | undefined): boolean {
  return typeof website === "string" && website.length > 0;
}

/** Coerce a loose `source` string to the `SubscriberSource` enum (default footer). */
function resolveSubscriberSource(source: string | undefined): SubscriberSource {
  if (source && source in SubscriberSource) {
    return SubscriberSource[source as keyof typeof SubscriberSource];
  }
  return SubscriberSource.footer;
}

// ───────────────────────────── bulk inquiry ─────────────────────────────

export type BulkInquiryRecord = Prisma.BulkInquiryGetPayload<true>;

/**
 * Validate and persist a corporate/bulk gifting inquiry as a `BulkInquiry`
 * (`status = new`). Converts the ₹ `budgetRupees` to integer `budget` paise.
 * Returns the created row on success.
 */
export async function createBulkInquiry(
  input: BulkInquiryInput,
): Promise<ActionResult<BulkInquiryRecord>> {
  const parsed = bulkInquirySchema.safeParse(input);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  if (honeypotTripped(data.website)) return fail(SPAM_REJECTION);

  const inquiry = await prisma.bulkInquiry.create({
    data: {
      name: data.name,
      company: data.company ?? null,
      phone: data.phone,
      email: data.email,
      productInterest: data.productInterest ?? null,
      quantity: data.quantity ?? null,
      occasion: data.occasion ?? null,
      budget:
        data.budgetRupees === undefined
          ? null
          : rupeesToPaise(data.budgetRupees),
      deadline: data.deadline ?? null,
      message: data.message,
      status: InquiryStatus.new,
    },
  });

  return ok(inquiry);
}

// ───────────────────────────── contact message ─────────────────────────────

export type ContactMessageRecord = Prisma.ContactMessageGetPayload<true>;

/**
 * Validate and persist a general contact-form submission as a `ContactMessage`
 * (`status = new`).
 */
export async function createContactMessage(
  input: ContactInput,
): Promise<ActionResult<ContactMessageRecord>> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  if (honeypotTripped(data.website)) return fail(SPAM_REJECTION);

  const message = await prisma.contactMessage.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      subject: data.subject ?? null,
      message: data.message,
      status: ContactStatus.new,
    },
  });

  return ok(message);
}

// ───────────────────────────── newsletter ─────────────────────────────

export type NewsletterSubscriberRecord =
  Prisma.NewsletterSubscriberGetPayload<true>;

/**
 * Idempotent newsletter signup keyed by unique `email` (`05` FR-10, single
 * opt-in). A new email is inserted; an existing one is reactivated
 * (`isActive=true`, clearing `unsubscribedAt`) so re-subscribing after an
 * unsubscribe works without leaking that the address already existed.
 */
export async function subscribeNewsletter(
  input: NewsletterInput,
): Promise<ActionResult<NewsletterSubscriberRecord>> {
  const parsed = newsletterSchema.safeParse(input);
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  if (honeypotTripped(data.website)) return fail(SPAM_REJECTION);

  const source = resolveSubscriberSource(data.source);

  const subscriber = await prisma.newsletterSubscriber.upsert({
    where: { email: data.email },
    create: { email: data.email, source, isActive: true },
    // Reactivate a previously-unsubscribed address; keep the original `source`.
    update: { isActive: true, unsubscribedAt: null },
  });

  return ok(subscriber);
}

// ───────────────────────────── admin reads ─────────────────────────────

export interface BulkInquiryListFilter {
  status?: InquiryStatus;
  /** Case-insensitive match against name / company / email / phone. */
  search?: string;
  take?: number;
  skip?: number;
}

export type BulkInquiryListResult = {
  items: BulkInquiryRecord[];
  total: number;
};

/**
 * Admin list of bulk inquiries, newest first, with optional status filter and
 * a free-text search across the contact fields. Returns the page plus the
 * total count for pagination.
 */
export async function adminListBulkInquiries(
  filter: BulkInquiryListFilter = {},
): Promise<BulkInquiryListResult> {
  const { status, search, take = 50, skip = 0 } = filter;

  const where: Prisma.BulkInquiryWhereInput = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { company: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.bulkInquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.bulkInquiry.count({ where }),
  ]);

  return { items, total };
}

export interface ContactMessageListFilter {
  status?: ContactStatus;
  /** Case-insensitive match against name / email / subject. */
  search?: string;
  take?: number;
  skip?: number;
}

export type ContactMessageListResult = {
  items: ContactMessageRecord[];
  total: number;
};

/**
 * Admin list of contact messages, newest first, with optional status filter
 * and free-text search. Returns the page plus the total count.
 */
export async function adminListContactMessages(
  filter: ContactMessageListFilter = {},
): Promise<ContactMessageListResult> {
  const { status, search, take = 50, skip = 0 } = filter;

  const where: Prisma.ContactMessageWhereInput = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { subject: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.contactMessage.count({ where }),
  ]);

  return { items, total };
}
