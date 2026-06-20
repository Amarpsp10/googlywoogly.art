"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { NON_STAFF_ROLES } from "@/lib/auth/types";
import { writeAudit } from "@/lib/admin/audit";
import { revalidateContentPage, revalidateFaq } from "@/lib/revalidate";
import { ok, fail, type ActionResult } from "@/lib/result";
import { cmsPageInputSchema } from "@/lib/validations/content";
import { field, optionalField, boolField, FAQ_PAGE_SLUG } from "@/lib/admin/content-shared";
import { sanitizeRichHtml, richTextToPlain } from "@/lib/admin/sanitize-html";
import type { ContentFormState } from "../_components/content-form-state";
import { liveUrl, formOk, formFail, formValidationFail } from "./shared";

/**
 * CMS page Server Actions (doc 15 §6.4 / FR-19–FR-22, FR-37). `requireRole(owner|
 * admin)` → **sanitize `bodyRich`** server-side (FR-28) → validate → stale-guard
 * (FR-25) → write (+ `Redirect` on slug change, FR-22) → `writeAudit` →
 * `revalidateContentPage(slug)` + `revalidatePath('/{slug}')` (+ `faq` if the FAQ
 * page). `title` + non-empty body are required to publish (FR-19).
 */

const ROLES = NON_STAFF_ROLES;

const auditSelect = {
  id: true,
  slug: true,
  title: true,
  bodyRich: true,
  metaTitle: true,
  metaDescription: true,
  isPublished: true,
  lastReviewedAt: true,
} satisfies Prisma.CmsPageSelect;

/** Revalidate a CMS page: tag + path (+ `faq` tag when it's the FAQ page). */
function revalidateCmsPage(slug: string, oldSlug?: string): void {
  revalidateContentPage(slug);
  revalidatePath(`/${slug}`);
  if (slug === FAQ_PAGE_SLUG) revalidateFaq();
  if (oldSlug && oldSlug !== slug) {
    revalidateContentPage(oldSlug);
    revalidatePath(`/${oldSlug}`);
  }
}

// ───────────────────────────── upsertCmsPage ─────────────────────────────

/**
 * Create or update + publish a CMS page. Form action (`useActionState`). On a
 * (rare) slug change, writes a 301 `Redirect{ from, to }` and revalidates both
 * old and new paths (FR-22).
 */
export async function upsertCmsPage(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const admin = await requireRole(ROLES);

  // Sanitize the rich body BEFORE validation (the stored, validated value is the
  // sanitized HTML — the client is never trusted, FR-28).
  const rawBody = field(formData, "bodyRich");
  const bodyRich = sanitizeRichHtml(rawBody);
  const isPublished = boolField(formData, "isPublished");

  // If the author typed only disallowed markup, the sanitized body is empty even
  // though the raw input wasn't — surface a clear field error rather than storing "".
  if (rawBody.trim() && !richTextToPlain(bodyRich)) {
    return formValidationFail({ bodyRich: ["Add page content using the supported formatting."] });
  }
  // A page can only be published with non-empty real content (FR-19/FR-29).
  if (isPublished && !richTextToPlain(bodyRich)) {
    return formValidationFail({ bodyRich: ["Add page content before publishing."] });
  }

  const candidate = {
    id: optionalField(formData, "id"),
    slug: field(formData, "slug"),
    title: field(formData, "title"),
    bodyRich, // validate the sanitized HTML (schema enforces min length)
    metaTitle: optionalField(formData, "metaTitle"),
    metaDescription: optionalField(formData, "metaDescription"),
    isPublished,
    expectedUpdatedAt: optionalField(formData, "expectedUpdatedAt"),
  };

  const parsed = cmsPageInputSchema.safeParse(candidate);
  if (!parsed.success) {
    return formValidationFail(parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  // Resolve the row: by id, else by slug (the fixed pages are addressed by slug).
  const existing = input.id
    ? await prisma.cmsPage.findUnique({ where: { id: input.id }, select: { ...auditSelect, updatedAt: true } })
    : await prisma.cmsPage.findUnique({ where: { slug: input.slug }, select: { ...auditSelect, updatedAt: true } });

  // Stale-guard (FR-25): reject if the row changed since the editor loaded it.
  if (existing && input.expectedUpdatedAt) {
    if (existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
      return formFail("This page changed since you opened it — reload and try again.");
    }
  }

  const slugChanged = Boolean(existing && existing.slug !== input.slug);
  // Guard a slug collision with a *different* page.
  if (slugChanged) {
    const clash = await prisma.cmsPage.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (clash && clash.id !== existing!.id) {
      return formValidationFail({ slug: ["Another page already uses that slug."] });
    }
  }

  const data = {
    slug: input.slug,
    title: input.title,
    bodyRich: input.bodyRich, // already sanitized above
    metaTitle: input.metaTitle ?? null,
    metaDescription: input.metaDescription ?? null,
    isPublished: input.isPublished,
  };

  try {
    const saved = await prisma.$transaction(async (tx) => {
      if (existing) {
        const after = await tx.cmsPage.update({ where: { id: existing.id }, data, select: auditSelect });
        if (slugChanged) {
          const fromPath = `/${existing.slug}`;
          const toPath = `/${input.slug}`;
          await tx.redirect.upsert({
            where: { fromPath },
            create: { fromPath, toPath, statusCode: 301 },
            update: { toPath, statusCode: 301 },
          });
          await tx.redirect.updateMany({ where: { toPath: fromPath }, data: { toPath } });
        }
        await writeAudit(
          { adminId: admin.id, action: "cms_page.update", entityType: "CmsPage", entityId: after.id, before: existing, after },
          tx,
        );
        return after;
      }
      const after = await tx.cmsPage.create({ data, select: auditSelect });
      await writeAudit(
        { adminId: admin.id, action: "cms_page.create", entityType: "CmsPage", entityId: after.id, after },
        tx,
      );
      return after;
    });

    revalidateCmsPage(saved.slug, existing?.slug);
    const live = liveUrl(`/${saved.slug}`);
    return formOk(
      saved.isPublished ? "Page published — live in a few seconds." : "Draft saved.",
      saved.isPublished ? live : undefined,
    );
  } catch (err) {
    console.error("[cms_page] upsert failed", err);
    return formFail("Couldn't save the page. Please try again.");
  }
}

// ───────────────────────────── markCmsPageReviewed ───────────────────────────

/**
 * Stamp `lastReviewedAt = now` for a legal/content page (doc 15 FR-37 governance
 * gate). Records the reviewing admin via `AuditLog`.
 */
export async function markCmsPageReviewed(id: string): Promise<ActionResult> {
  const admin = await requireRole(ROLES);

  const existing = await prisma.cmsPage.findUnique({ where: { id }, select: auditSelect });
  if (!existing) return fail("That page no longer exists.");

  await prisma.$transaction(async (tx) => {
    const after = await tx.cmsPage.update({
      where: { id },
      data: { lastReviewedAt: new Date() },
      select: auditSelect,
    });
    await writeAudit(
      { adminId: admin.id, action: "cms_page.review", entityType: "CmsPage", entityId: id, before: existing, after },
      tx,
    );
  });
  revalidateCmsPage(existing.slug);
  return ok(undefined);
}
