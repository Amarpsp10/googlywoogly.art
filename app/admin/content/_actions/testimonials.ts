"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { NON_STAFF_ROLES } from "@/lib/auth/types";
import { writeAudit } from "@/lib/admin/audit";
import { revalidateTestimonials } from "@/lib/revalidate";
import { ok, fail, type ActionResult } from "@/lib/result";
import { testimonialInputSchema, reorderSchema } from "@/lib/validations/content";
import { field, optionalField, intField } from "@/lib/admin/content-shared";
import type { ContentFormState } from "../_components/content-form-state";
import { liveUrl, formOk, formFail, formValidationFail } from "./shared";

/**
 * Testimonial Server Actions (doc 15 §6.3 / FR-13–FR-15). `requireRole(owner|
 * admin)` → validate → write → `writeAudit("testimonial.*")` →
 * `revalidateTestimonials()` (busts `testimonials` + `home`). New rows default
 * `isApproved=false` (moderate-before-show, FR-13). `text` is plain/light — we
 * store it as the founder typed it (escaped at render); no HTML formatting is
 * implied for testimonials.
 */

const ROLES = NON_STAFF_ROLES;

const auditSelect = {
  id: true,
  customerName: true,
  location: true,
  rating: true,
  text: true,
  imageId: true,
  isApproved: true,
  isFeatured: true,
  sortOrder: true,
} satisfies Prisma.TestimonialSelect;

/** Bust `testimonials` + `home` tags and the `/` path (doc 15 §6.7). */
function revalidateTestimonialsAll(): void {
  revalidateTestimonials();
  revalidatePath("/");
}

// ───────────────────────────── upsertTestimonial ─────────────────────────────

/** Create or update a testimonial. New ones are unapproved (FR-13). */
export async function upsertTestimonial(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const admin = await requireRole(ROLES);

  const candidate = {
    id: optionalField(formData, "id"),
    customerName: field(formData, "customerName"),
    location: optionalField(formData, "location"),
    rating: intField(formData, "rating"),
    text: field(formData, "text"),
    imageId: optionalField(formData, "imageId"),
    sortOrder: intField(formData, "sortOrder") ?? 0,
    isFeatured: false, // featuring is a separate one-tap action (FR-13)
  };

  const parsed = testimonialInputSchema.safeParse(candidate);
  if (!parsed.success) {
    return formValidationFail(parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  try {
    if (input.id) {
      const existing = await prisma.testimonial.findUnique({
        where: { id: input.id },
        select: auditSelect,
      });
      if (!existing) return formFail("That testimonial no longer exists.");

      await prisma.$transaction(async (tx) => {
        const after = await tx.testimonial.update({
          where: { id: input.id },
          data: {
            customerName: input.customerName,
            location: input.location ?? null,
            rating: input.rating ?? null,
            text: input.text,
            imageId: input.imageId ?? null,
            sortOrder: input.sortOrder,
          },
          select: auditSelect,
        });
        await writeAudit(
          { adminId: admin.id, action: "testimonial.update", entityType: "Testimonial", entityId: after.id, before: existing, after },
          tx,
        );
      });
      revalidateTestimonialsAll();
      return formOk("Testimonial updated.", liveUrl("/"));
    }

    await prisma.$transaction(async (tx) => {
      const after = await tx.testimonial.create({
        data: {
          customerName: input.customerName,
          location: input.location ?? null,
          rating: input.rating ?? null,
          text: input.text,
          imageId: input.imageId ?? null,
          sortOrder: input.sortOrder,
          isApproved: false,
          isFeatured: false,
        },
        select: auditSelect,
      });
      await writeAudit(
        { adminId: admin.id, action: "testimonial.create", entityType: "Testimonial", entityId: after.id, after },
        tx,
      );
    });
    revalidateTestimonialsAll();
    return formOk("Testimonial added — approve it to show it on the site.");
  } catch (err) {
    console.error("[testimonial] upsert failed", err);
    return formFail("Couldn't save the testimonial. Please try again.");
  }
}

// ───────────────────────────── moderateTestimonial ───────────────────────────

/** Approve / unapprove a testimonial (one-tap, FR-13). */
export async function moderateTestimonial(id: string, isApproved: boolean): Promise<ActionResult> {
  const admin = await requireRole(ROLES);

  const existing = await prisma.testimonial.findUnique({ where: { id }, select: auditSelect });
  if (!existing) return fail("That testimonial no longer exists.");

  await prisma.$transaction(async (tx) => {
    const after = await tx.testimonial.update({ where: { id }, data: { isApproved }, select: auditSelect });
    await writeAudit(
      { adminId: admin.id, action: "testimonial.moderate", entityType: "Testimonial", entityId: id, before: existing, after },
      tx,
    );
  });
  revalidateTestimonialsAll();
  return ok(undefined);
}

// ───────────────────────────── featureTestimonial ────────────────────────────

/** Feature / unfeature a testimonial (one-tap, FR-13). */
export async function featureTestimonial(id: string, isFeatured: boolean): Promise<ActionResult> {
  const admin = await requireRole(ROLES);

  const existing = await prisma.testimonial.findUnique({ where: { id }, select: auditSelect });
  if (!existing) return fail("That testimonial no longer exists.");

  await prisma.$transaction(async (tx) => {
    const after = await tx.testimonial.update({ where: { id }, data: { isFeatured }, select: auditSelect });
    await writeAudit(
      { adminId: admin.id, action: "testimonial.feature", entityType: "Testimonial", entityId: id, before: existing, after },
      tx,
    );
  });
  revalidateTestimonialsAll();
  return ok(undefined);
}

// ───────────────────────────── reorderTestimonials ───────────────────────────

/** Persist a dense `sortOrder` from an ordered id list (FR-13). */
export async function reorderTestimonials(orderedIds: string[]): Promise<ActionResult> {
  const admin = await requireRole(ROLES);

  const parsed = reorderSchema.safeParse({ orderedIds });
  if (!parsed.success) return fail("Invalid reorder request.");

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      parsed.data.orderedIds.map((id, i) =>
        tx.testimonial.update({ where: { id }, data: { sortOrder: (i + 1) * 10 } }),
      ),
    );
    await writeAudit(
      { adminId: admin.id, action: "testimonial.reorder", entityType: "Testimonial", entityId: parsed.data.orderedIds[0], after: { orderedIds: parsed.data.orderedIds } },
      tx,
    );
  });
  revalidateTestimonialsAll();
  return ok(undefined);
}

// ───────────────────────────── deleteTestimonial ─────────────────────────────

/** Delete a testimonial. */
export async function deleteTestimonial(formData: FormData): Promise<void> {
  const admin = await requireRole(ROLES);
  const id = field(formData, "id");
  if (!id) return;

  const existing = await prisma.testimonial.findUnique({ where: { id }, select: auditSelect });
  if (!existing) return;

  await prisma.$transaction(async (tx) => {
    await tx.testimonial.delete({ where: { id } });
    await writeAudit(
      { adminId: admin.id, action: "testimonial.delete", entityType: "Testimonial", entityId: id, before: existing },
      tx,
    );
  });
  revalidateTestimonialsAll();
}
