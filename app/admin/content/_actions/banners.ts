"use server";

import { revalidatePath } from "next/cache";
import { Prisma, BannerType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { NON_STAFF_ROLES } from "@/lib/auth/types";
import { writeAudit } from "@/lib/admin/audit";
import { revalidateHome } from "@/lib/revalidate";
import { ok, fail, type ActionResult } from "@/lib/result";
import { bannerInputSchema } from "@/lib/validations/content";
import {
  field,
  optionalField,
  intField,
  boolField,
  istLocalToDate,
} from "@/lib/admin/content-shared";
import { sanitizeRichHtml } from "@/lib/admin/sanitize-html";
import type { ContentFormState } from "../_components/content-form-state";
import { liveUrl, formOk, formFail, formValidationFail } from "./shared";

/**
 * Banner Server Actions (doc 15 §6.2). `requireRole(owner|admin)` → validate
 * (`startsAt ≤ endsAt`; marquee text required) → write → `writeAudit("banner.*")`
 * → `revalidateHome()` (busts `banners` + `home`) + `/`. Promo/marquee text is
 * sanitized server-side (FR-28). Times are entered in IST, stored UTC (FR-10).
 */

const ROLES = NON_STAFF_ROLES;

const auditSelect = {
  id: true,
  type: true,
  text: true,
  imageId: true,
  link: true,
  startsAt: true,
  endsAt: true,
  sortOrder: true,
  isActive: true,
} satisfies Prisma.BannerSelect;

/** Bust `banners` + `home` tags and the `/` path (doc 15 §6.7). */
function revalidateBannersAll(): void {
  revalidateHome();
  revalidatePath("/");
}

// ───────────────────────────── upsertBanner ─────────────────────────────

/** Create or update a banner (marquee/hero/promo) with an optional schedule. */
export async function upsertBanner(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const admin = await requireRole(ROLES);

  const typeRaw = field(formData, "type");
  if (!(typeRaw in BannerType)) return formFail("Pick a valid banner type.");

  // Parse the IST datetime-local inputs to UTC Dates (null ⇒ invalid string).
  const startsAt = istLocalToDate(optionalField(formData, "startsAt"));
  const endsAt = istLocalToDate(optionalField(formData, "endsAt"));
  if (startsAt === null) return formValidationFail({ startsAt: ["Enter a valid start date/time."] });
  if (endsAt === null) return formValidationFail({ endsAt: ["Enter a valid end date/time."] });

  const candidate = {
    id: optionalField(formData, "id"),
    type: BannerType[typeRaw as keyof typeof BannerType],
    // Sanitize promo/marquee text (it can carry light formatting / links).
    text: optionalField(formData, "text")
      ? sanitizeRichHtml(field(formData, "text"))
      : undefined,
    imageId: optionalField(formData, "imageId"),
    link: optionalField(formData, "link"),
    startsAt,
    endsAt,
    sortOrder: intField(formData, "sortOrder") ?? 0,
    isActive: boolField(formData, "isActive"),
  };

  const parsed = bannerInputSchema.safeParse(candidate);
  if (!parsed.success) {
    return formValidationFail(parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  const data = {
    type: input.type,
    text: input.text ?? null,
    imageId: input.imageId ?? null,
    link: input.link ?? null,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  };

  try {
    if (input.id) {
      const existing = await prisma.banner.findUnique({
        where: { id: input.id },
        select: auditSelect,
      });
      if (!existing) return formFail("That banner no longer exists.");

      await prisma.$transaction(async (tx) => {
        const after = await tx.banner.update({
          where: { id: input.id },
          data,
          select: auditSelect,
        });
        await writeAudit(
          { adminId: admin.id, action: "banner.update", entityType: "Banner", entityId: after.id, before: existing, after },
          tx,
        );
      });
      revalidateBannersAll();
      return formOk("Banner updated.", liveUrl("/"));
    }

    await prisma.$transaction(async (tx) => {
      const after = await tx.banner.create({ data, select: auditSelect });
      await writeAudit(
        { adminId: admin.id, action: "banner.create", entityType: "Banner", entityId: after.id, after },
        tx,
      );
    });
    revalidateBannersAll();
    return formOk("Banner created.", liveUrl("/"));
  } catch (err) {
    console.error("[banner] upsert failed", err);
    return formFail("Couldn't save the banner. Please try again.");
  }
}

// ───────────────────────────── toggleBanner ─────────────────────────────

/** Flip a banner's `isActive` (one-tap). */
export async function toggleBanner(id: string, isActive: boolean): Promise<ActionResult> {
  const admin = await requireRole(ROLES);

  const existing = await prisma.banner.findUnique({ where: { id }, select: auditSelect });
  if (!existing) return fail("That banner no longer exists.");

  await prisma.$transaction(async (tx) => {
    const after = await tx.banner.update({ where: { id }, data: { isActive }, select: auditSelect });
    await writeAudit(
      { adminId: admin.id, action: "banner.toggle", entityType: "Banner", entityId: id, before: existing, after },
      tx,
    );
  });
  revalidateBannersAll();
  return ok(undefined);
}

// ───────────────────────────── deleteBanner ─────────────────────────────

/** Delete a banner. */
export async function deleteBanner(formData: FormData): Promise<void> {
  const admin = await requireRole(ROLES);
  const id = field(formData, "id");
  if (!id) return;

  const existing = await prisma.banner.findUnique({ where: { id }, select: auditSelect });
  if (!existing) return;

  await prisma.$transaction(async (tx) => {
    await tx.banner.delete({ where: { id } });
    await writeAudit(
      { adminId: admin.id, action: "banner.delete", entityType: "Banner", entityId: id, before: existing },
      tx,
    );
  });
  revalidateBannersAll();
}

// ───────────────────────────── duplicateBanner ─────────────────────────────

/**
 * Clone a banner as a fresh, **off** copy with its schedule cleared, so the
 * founder can reschedule an expired campaign (doc 15 §6.2 / §4.3).
 */
export async function duplicateBanner(id: string): Promise<ActionResult> {
  const admin = await requireRole(ROLES);

  const source = await prisma.banner.findUnique({ where: { id }, select: auditSelect });
  if (!source) return fail("That banner no longer exists.");

  await prisma.$transaction(async (tx) => {
    const clone = await tx.banner.create({
      data: {
        type: source.type,
        text: source.text,
        imageId: source.imageId,
        link: source.link,
        startsAt: null,
        endsAt: null,
        sortOrder: source.sortOrder + 1,
        isActive: false,
      },
      select: auditSelect,
    });
    await writeAudit(
      { adminId: admin.id, action: "banner.duplicate", entityType: "Banner", entityId: clone.id, after: clone },
      tx,
    );
  });
  revalidateBannersAll();
  return ok(undefined);
}
