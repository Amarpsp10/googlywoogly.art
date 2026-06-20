"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { NON_STAFF_ROLES } from "@/lib/auth/types";
import { writeAudit } from "@/lib/admin/audit";
import { revalidateFaq } from "@/lib/revalidate";
import { ok, fail, type ActionResult } from "@/lib/result";
import { faqItemInputSchema, reorderSchema } from "@/lib/validations/content";
import { field, optionalField, intField, boolField } from "@/lib/admin/content-shared";
import { sanitizeRichHtml, richTextToPlain } from "@/lib/admin/sanitize-html";
import type { ContentFormState } from "../_components/content-form-state";
import { liveUrl, formOk, formFail, formValidationFail } from "./shared";

/**
 * FAQ Server Actions (doc 15 §6.3 / FR-16–FR-18). `requireRole(owner|admin)` →
 * sanitize the rich `answer` server-side (FR-28) → validate → write →
 * `writeAudit("faq_item.*")` → `revalidateFaq()` + `revalidatePath('/faq')`.
 * An answer that is empty after sanitization is rejected (would break the
 * `FAQPage` JSON-LD, FR-17).
 */

const ROLES = NON_STAFF_ROLES;

const auditSelect = {
  id: true,
  question: true,
  answer: true,
  category: true,
  sortOrder: true,
  isPublished: true,
} satisfies Prisma.FaqItemSelect;

/** Bust `faq` tag + the `/faq` route after a mutation. */
function revalidateFaqAll(): void {
  revalidateFaq();
  revalidatePath("/faq");
}

// ───────────────────────────── upsertFaqItem ─────────────────────────────

/** Create or update a FAQ item (rich answer sanitized server-side). */
export async function upsertFaqItem(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const admin = await requireRole(ROLES);

  const answer = sanitizeRichHtml(field(formData, "answer"));
  if (!richTextToPlain(answer)) {
    return formValidationFail({ answer: ["Answer is required (and can't be only formatting)."] });
  }

  const candidate = {
    id: optionalField(formData, "id"),
    question: field(formData, "question"),
    answer,
    category: optionalField(formData, "category"),
    sortOrder: intField(formData, "sortOrder") ?? 0,
    isPublished: boolField(formData, "isPublished"),
  };

  const parsed = faqItemInputSchema.safeParse(candidate);
  if (!parsed.success) {
    return formValidationFail(parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  const data = {
    question: input.question,
    answer: input.answer,
    category: input.category ?? null,
    sortOrder: input.sortOrder,
    isPublished: input.isPublished,
  };

  try {
    if (input.id) {
      const existing = await prisma.faqItem.findUnique({ where: { id: input.id }, select: auditSelect });
      if (!existing) return formFail("That FAQ no longer exists.");

      await prisma.$transaction(async (tx) => {
        const after = await tx.faqItem.update({ where: { id: input.id }, data, select: auditSelect });
        await writeAudit(
          { adminId: admin.id, action: "faq_item.update", entityType: "FaqItem", entityId: after.id, before: existing, after },
          tx,
        );
      });
      revalidateFaqAll();
      return formOk("FAQ updated.", liveUrl("/faq"));
    }

    await prisma.$transaction(async (tx) => {
      const after = await tx.faqItem.create({ data, select: auditSelect });
      await writeAudit(
        { adminId: admin.id, action: "faq_item.create", entityType: "FaqItem", entityId: after.id, after },
        tx,
      );
    });
    revalidateFaqAll();
    return formOk("FAQ added.", liveUrl("/faq"));
  } catch (err) {
    console.error("[faq] upsert failed", err);
    return formFail("Couldn't save the FAQ. Please try again.");
  }
}

// ───────────────────────────── toggleFaqItem ─────────────────────────────

/** Publish / unpublish a FAQ item (one-tap). */
export async function toggleFaqItem(id: string, isPublished: boolean): Promise<ActionResult> {
  const admin = await requireRole(ROLES);

  const existing = await prisma.faqItem.findUnique({ where: { id }, select: auditSelect });
  if (!existing) return fail("That FAQ no longer exists.");

  await prisma.$transaction(async (tx) => {
    const after = await tx.faqItem.update({ where: { id }, data: { isPublished }, select: auditSelect });
    await writeAudit(
      { adminId: admin.id, action: "faq_item.toggle", entityType: "FaqItem", entityId: id, before: existing, after },
      tx,
    );
  });
  revalidateFaqAll();
  return ok(undefined);
}

// ───────────────────────────── reorderFaqItems ─────────────────────────────

/** Persist a dense `sortOrder` from an ordered id list (FR-16, within category). */
export async function reorderFaqItems(orderedIds: string[]): Promise<ActionResult> {
  const admin = await requireRole(ROLES);

  const parsed = reorderSchema.safeParse({ orderedIds });
  if (!parsed.success) return fail("Invalid reorder request.");

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      parsed.data.orderedIds.map((id, i) =>
        tx.faqItem.update({ where: { id }, data: { sortOrder: (i + 1) * 10 } }),
      ),
    );
    await writeAudit(
      { adminId: admin.id, action: "faq_item.reorder", entityType: "FaqItem", entityId: parsed.data.orderedIds[0], after: { orderedIds: parsed.data.orderedIds } },
      tx,
    );
  });
  revalidateFaqAll();
  return ok(undefined);
}

// ───────────────────────────── deleteFaqItem ─────────────────────────────

/** Delete a FAQ item. */
export async function deleteFaqItem(formData: FormData): Promise<void> {
  const admin = await requireRole(ROLES);
  const id = field(formData, "id");
  if (!id) return;

  const existing = await prisma.faqItem.findUnique({ where: { id }, select: auditSelect });
  if (!existing) return;

  await prisma.$transaction(async (tx) => {
    await tx.faqItem.delete({ where: { id } });
    await writeAudit(
      { adminId: admin.id, action: "faq_item.delete", entityType: "FaqItem", entityId: id, before: existing },
      tx,
    );
  });
  revalidateFaqAll();
}

// ───────────────────────────── seedRecommendedFaqs ───────────────────────────

/** The recommended starter FAQ set (doc 15 §7.3). */
const RECOMMENDED_FAQS: { question: string; answer: string; category: string }[] = [
  { question: "How long until my order ships?", answer: "<p>In-stock items are dispatched in 2–3 business days. Made-to-order pieces show their crafting time on the product page. Your tracking is shared on WhatsApp and email.</p>", category: "Orders & Shipping" },
  { question: "Do you ship across India?", answer: "<p>Yes — we ship pan-India. International orders are handled via our bulk enquiry only.</p>", category: "Orders & Shipping" },
  { question: "What are the shipping charges?", answer: "<p>We charge a flat shipping fee, and shipping is free over our free-shipping threshold (see your cart for the current amounts).</p>", category: "Orders & Shipping" },
  { question: "How do I track my order?", answer: "<p>Use the private tracking link we send you after you place your order.</p>", category: "Orders & Shipping" },
  { question: "How do I pay?", answer: "<p>After you place a request, we confirm availability and collect payment and coordinate on WhatsApp — no card is needed on the site.</p>", category: "Payments" },
  { question: "Is online payment safe?", answer: "<p>We don't store card details. Payment is handled directly via WhatsApp (UPI or bank transfer).</p>", category: "Payments" },
  { question: "Are your products handmade / made-to-order?", answer: "<p>Yes — each piece is handcrafted in Jaipur, and some are made-to-order with a short lead time. Small variations are part of the charm.</p>", category: "Products & Care" },
  { question: "Can I personalize a gift or add a gift message?", answer: "<p>Yes, where the product allows — add your text at checkout.</p>", category: "Products & Care" },
  { question: "How do I care for my item?", answer: "<p>See our Care Guide; product-specific tips are on each product page.</p>", category: "Products & Care" },
  { question: "Can I cancel or return?", answer: "<p>Cancel before dispatch or before production begins via WhatsApp. Made-to-order and personalized items have limits; damaged items are replaced or refunded. See our Cancellation & Refund Policy.</p>", category: "Returns" },
  { question: "Do you do corporate / bulk gifting?", answer: "<p>Yes — tell us on the Bulk Orders page and we'll quote on WhatsApp.</p>", category: "Bulk" },
];

/** Insert the recommended FAQ set when there are zero rows (FR-17). */
export async function seedRecommendedFaqs(): Promise<ActionResult<{ count: number }>> {
  const admin = await requireRole(ROLES);

  const count = await prisma.faqItem.count();
  if (count > 0) return fail("You already have FAQs. Add new ones individually.");

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      RECOMMENDED_FAQS.map((f, i) =>
        tx.faqItem.create({
          data: {
            question: f.question,
            answer: sanitizeRichHtml(f.answer),
            category: f.category,
            sortOrder: (i + 1) * 10,
            isPublished: true,
          },
        }),
      ),
    );
    await writeAudit({
      adminId: admin.id,
      action: "faq_item.seed",
      entityType: "FaqItem",
      entityId: "seed",
      after: { count: RECOMMENDED_FAQS.length },
    }, tx);
  });
  revalidateFaqAll();
  return ok({ count: RECOMMENDED_FAQS.length });
}
