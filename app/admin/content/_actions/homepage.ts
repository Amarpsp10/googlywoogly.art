"use server";

import { revalidatePath } from "next/cache";
import { Prisma, HomepageSectionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { NON_STAFF_ROLES } from "@/lib/auth/types";
import { writeAudit } from "@/lib/admin/audit";
import { revalidateHome } from "@/lib/revalidate";
import { ok, fail, type ActionResult } from "@/lib/result";
import {
  homepageSectionPayloadSchema,
  reorderSchema,
  type HomepageSectionPayload,
} from "@/lib/validations/content";
import { slugify } from "@/lib/slug";
import {
  field,
  optionalField,
  intField,
  boolField,
  SECTION_TYPE_META,
} from "@/lib/admin/content-shared";
import { sanitizeRichHtml, richTextToPlain } from "@/lib/admin/sanitize-html";
import type { ContentFormState } from "../_components/content-form-state";
import { liveUrl, formOk, formFail, formValidationFail } from "./shared";

/**
 * Homepage section Server Actions (doc 15 §6.1). Every action:
 *  (1) `requireRole(owner|admin)` — content is non-staff (nav-config),
 *  (2) validates the payload with the discriminated-union Zod schema (FR-7),
 *  (3) sanitizes rich prose (`story`/`rich_text` body) server-side (FR-28),
 *  (4) writes via prisma + `writeAudit("homepage_section.*")`,
 *  (5) `revalidateHome()` (busts `home` + `banners`) + `/` path (FR-3),
 *  (6) returns `ContentFormState` (form actions) / `ActionResult` (toggles).
 *
 * `HomepageSectionType` is a CLOSED set (FR-5): the founder reorders/toggles/
 * edits payloads but cannot invent new types. Singleton types (hero, newsletter,
 * …) are limited to one active instance (FR-6).
 */

const ROLES = NON_STAFF_ROLES;

const auditSelect = {
  id: true,
  key: true,
  type: true,
  payload: true,
  sortOrder: true,
  isActive: true,
} satisfies Prisma.HomepageSectionSelect;

/** Re-revalidate after a homepage mutation: `home`/`banners` tags + `/` (doc 15 §6.7). */
function revalidateHomepage(): void {
  revalidateHome();
  revalidatePath("/");
}

/**
 * Assemble a typed payload object from flat FormData for a given section `type`,
 * then validate it against the discriminated union. Numeric arrays (productIds,
 * collectionIds, faqIds) arrive as comma/newline-separated text. Rich prose is
 * sanitized **before** validation so length checks run on the stored value.
 */
function buildPayload(
  type: HomepageSectionType,
  formData: FormData,
): { ok: true; payload: HomepageSectionPayload } | { ok: false; state: ContentFormState } {
  const ids = (name: string): string[] | undefined => {
    const raw = optionalField(formData, name);
    if (!raw) return undefined;
    const list = raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return list.length ? list : undefined;
  };

  // Shared optional heading/sub-copy carried by most sections.
  const heading = {
    title: optionalField(formData, "title"),
    sub: optionalField(formData, "sub"),
  };

  let candidate: Record<string, unknown>;
  switch (type) {
    case HomepageSectionType.hero:
      candidate = {
        type,
        headline: field(formData, "headline"),
        sub: optionalField(formData, "sub"),
        ctaLabel: optionalField(formData, "ctaLabel"),
        ctaHref: optionalField(formData, "ctaHref"),
        mediaId: optionalField(formData, "mediaId"),
      };
      break;
    case HomepageSectionType.featured_products:
      candidate = {
        type,
        ...heading,
        collectionId: optionalField(formData, "collectionId"),
        productIds: ids("productIds"),
        limit: intField(formData, "limit") ?? 8,
      };
      break;
    case HomepageSectionType.featured_collections:
      candidate = {
        type,
        ...heading,
        collectionIds: ids("collectionIds"),
        limit: intField(formData, "limit") ?? 6,
      };
      break;
    case HomepageSectionType.category_grid:
      candidate = { type, ...heading, limit: intField(formData, "limit") ?? 6 };
      break;
    case HomepageSectionType.bestsellers:
      candidate = {
        type,
        ...heading,
        collectionSlug: optionalField(formData, "collectionSlug"),
        limit: intField(formData, "limit") ?? 8,
      };
      break;
    case HomepageSectionType.testimonials:
      candidate = {
        type,
        ...heading,
        featuredOnly: boolField(formData, "featuredOnly"),
        limit: intField(formData, "limit") ?? 6,
      };
      break;
    case HomepageSectionType.banner:
      candidate = {
        type,
        ...heading,
        bannerId: optionalField(formData, "bannerId"),
        mediaId: optionalField(formData, "mediaId"),
        href: optionalField(formData, "href"),
      };
      break;
    case HomepageSectionType.story: {
      const body = sanitizeRichHtml(field(formData, "body"));
      if (!richTextToPlain(body)) {
        return { ok: false, state: formValidationFail({ body: ["Story text is required."] }) };
      }
      candidate = {
        type,
        title: optionalField(formData, "title"),
        body,
        mediaId: optionalField(formData, "mediaId"),
        ctaLabel: optionalField(formData, "ctaLabel"),
        ctaHref: optionalField(formData, "ctaHref"),
      };
      break;
    }
    case HomepageSectionType.instagram:
      candidate = {
        type,
        ...heading,
        handle: optionalField(formData, "handle"),
        // tiles are media-picker driven (V1) — omitted in the MVP textarea form.
      };
      break;
    case HomepageSectionType.newsletter:
      candidate = {
        type,
        title: optionalField(formData, "title"),
        sub: optionalField(formData, "sub"),
        consentText: optionalField(formData, "consentText"),
      };
      break;
    case HomepageSectionType.faq:
      candidate = {
        type,
        ...heading,
        faqIds: ids("faqIds"),
        limit: intField(formData, "limit") ?? 6,
      };
      break;
    case HomepageSectionType.rich_text: {
      const body = sanitizeRichHtml(field(formData, "body"));
      if (!richTextToPlain(body)) {
        return { ok: false, state: formValidationFail({ body: ["Content is required."] }) };
      }
      candidate = { type, title: optionalField(formData, "title"), body };
      break;
    }
    default:
      return { ok: false, state: formFail("Unknown section type.") };
  }

  const parsed = homepageSectionPayloadSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, state: formValidationFail(parsed.error.flatten().fieldErrors) };
  }
  return { ok: true, payload: parsed.data };
}

/** Generate a unique `key` for a new section (`{type}-{n}`). */
async function uniqueSectionKey(type: HomepageSectionType): Promise<string> {
  const base = slugify(type);
  let candidate = base;
  let n = 2;
  // Loop until we find a free key (keys are globally unique).
  while (await prisma.homepageSection.findUnique({ where: { key: candidate }, select: { id: true } })) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}

// ───────────────────────────── upsertHomepageSection ─────────────────────────

/**
 * Create or update a homepage section. Form action (`useActionState`). Validates
 * the typed payload, enforces singleton types on create (FR-6), and applies the
 * optimistic-concurrency stale-guard via `expectedUpdatedAt` (FR-25) on update.
 */
export async function upsertHomepageSection(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const admin = await requireRole(ROLES);

  const id = optionalField(formData, "id");
  const typeRaw = field(formData, "type");
  if (!(typeRaw in HomepageSectionType)) {
    return formFail("Pick a valid section type.");
  }
  const type = HomepageSectionType[typeRaw as keyof typeof HomepageSectionType];

  const built = buildPayload(type, formData);
  if (!built.ok) return built.state;

  const isActive = boolField(formData, "isActive");

  // Singleton guard (FR-6): only one *active* instance of a singleton type.
  if (SECTION_TYPE_META[type].singleton && isActive) {
    const clash = await prisma.homepageSection.findFirst({
      where: { type, isActive: true, ...(id ? { id: { not: id } } : {}) },
      select: { id: true },
    });
    if (clash) {
      return formFail(
        `Only one active "${SECTION_TYPE_META[type].label}" section is allowed. Hide the existing one first.`,
      );
    }
  }

  try {
    if (id) {
      const existing = await prisma.homepageSection.findUnique({
        where: { id },
        select: { ...auditSelect, updatedAt: true },
      });
      if (!existing) return formFail("That section no longer exists.");

      // Stale-guard (FR-25).
      const expected = optionalField(formData, "expectedUpdatedAt");
      if (expected && existing.updatedAt.toISOString() !== expected) {
        return formFail("This section changed since you opened it — reload and try again.");
      }

      const after = await prisma.$transaction(async (tx) => {
        const updated = await tx.homepageSection.update({
          where: { id },
          data: { payload: built.payload as Prisma.InputJsonValue, isActive },
          select: auditSelect,
        });
        await writeAudit(
          {
            adminId: admin.id,
            action: "homepage_section.update",
            entityType: "HomepageSection",
            entityId: id,
            before: existing,
            after: updated,
          },
          tx,
        );
        return updated;
      });
      revalidateHomepage();
      return formOk(`Updated the ${SECTION_TYPE_META[after.type].label} section.`, liveUrl("/"));
    }

    // Create: append to the end of the order.
    const max = await prisma.homepageSection.aggregate({ _max: { sortOrder: true } });
    const key = await uniqueSectionKey(type);
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.homepageSection.create({
        data: {
          key,
          type,
          payload: built.payload as Prisma.InputJsonValue,
          isActive,
          sortOrder: (max._max.sortOrder ?? 0) + 10,
        },
        select: auditSelect,
      });
      await writeAudit(
        {
          adminId: admin.id,
          action: "homepage_section.create",
          entityType: "HomepageSection",
          entityId: row.id,
          after: row,
        },
        tx,
      );
      return row;
    });
    revalidateHomepage();
    return formOk(`Added a ${SECTION_TYPE_META[created.type].label} section.`, liveUrl("/"));
  } catch (err) {
    console.error("[homepage] upsert failed", err);
    return formFail("Couldn't save the section. Please try again.");
  }
}

// ───────────────────────────── toggleHomepageSection ─────────────────────────

/** Flip a section's `isActive` (one-tap switch). Enforces the singleton guard. */
export async function toggleHomepageSection(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const admin = await requireRole(ROLES);

  const existing = await prisma.homepageSection.findUnique({
    where: { id },
    select: auditSelect,
  });
  if (!existing) return fail("That section no longer exists.");

  if (isActive && SECTION_TYPE_META[existing.type].singleton) {
    const clash = await prisma.homepageSection.findFirst({
      where: { type: existing.type, isActive: true, id: { not: id } },
      select: { id: true },
    });
    if (clash) {
      return fail(
        `Only one active "${SECTION_TYPE_META[existing.type].label}" section is allowed.`,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    const after = await tx.homepageSection.update({
      where: { id },
      data: { isActive },
      select: auditSelect,
    });
    await writeAudit(
      {
        adminId: admin.id,
        action: "homepage_section.toggle",
        entityType: "HomepageSection",
        entityId: id,
        before: existing,
        after,
      },
      tx,
    );
  });
  revalidateHomepage();
  return ok(undefined);
}

// ───────────────────────────── reorderHomepageSections ───────────────────────

/** Persist a dense `sortOrder` (10,20,30,…) from an ordered id list (FR-8). */
export async function reorderHomepageSections(orderedIds: string[]): Promise<ActionResult> {
  const admin = await requireRole(ROLES);

  const parsed = reorderSchema.safeParse({ orderedIds });
  if (!parsed.success) return fail("Invalid reorder request.");

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      parsed.data.orderedIds.map((id, i) =>
        tx.homepageSection.update({ where: { id }, data: { sortOrder: (i + 1) * 10 } }),
      ),
    );
    await writeAudit(
      {
        adminId: admin.id,
        action: "homepage_section.reorder",
        entityType: "HomepageSection",
        entityId: parsed.data.orderedIds[0],
        after: { orderedIds: parsed.data.orderedIds },
      },
      tx,
    );
  });
  revalidateHomepage();
  return ok(undefined);
}

// ───────────────────────────── deleteHomepageSection ─────────────────────────

/** Delete a homepage section. */
export async function deleteHomepageSection(formData: FormData): Promise<void> {
  const admin = await requireRole(ROLES);
  const id = field(formData, "id");
  if (!id) return;

  const existing = await prisma.homepageSection.findUnique({
    where: { id },
    select: auditSelect,
  });
  if (!existing) return;

  await prisma.$transaction(async (tx) => {
    await tx.homepageSection.delete({ where: { id } });
    await writeAudit(
      {
        adminId: admin.id,
        action: "homepage_section.delete",
        entityType: "HomepageSection",
        entityId: id,
        before: existing,
      },
      tx,
    );
  });
  revalidateHomepage();
}

// ───────────────────────────── seedDefaultHomepage ───────────────────────────

/** The code-default homepage section set (doc 05 §4.1 / prisma seed parity). */
const DEFAULT_SECTIONS: { key: string; type: HomepageSectionType; payload: HomepageSectionPayload }[] = [
  { key: "hero", type: HomepageSectionType.hero, payload: { type: HomepageSectionType.hero, headline: "Handmade with heart, in Jaipur", sub: "One-of-a-kind gifts & home décor, crafted by hand and made to be treasured.", ctaLabel: "Shop the collection", ctaHref: "/products" } },
  { key: "category_grid", type: HomepageSectionType.category_grid, payload: { type: HomepageSectionType.category_grid, title: "Shop by category", limit: 6 } },
  { key: "featured_collections", type: HomepageSectionType.featured_collections, payload: { type: HomepageSectionType.featured_collections, title: "Gifts for every occasion", limit: 6 } },
  { key: "bestsellers", type: HomepageSectionType.bestsellers, payload: { type: HomepageSectionType.bestsellers, title: "Loved by our customers", collectionSlug: "bestsellers", limit: 8 } },
  { key: "story", type: HomepageSectionType.story, payload: { type: HomepageSectionType.story, title: "Meet the maker", body: "<p>Every piece is designed and crafted by Vanshika in her Jaipur studio.</p>" } },
  { key: "testimonials", type: HomepageSectionType.testimonials, payload: { type: HomepageSectionType.testimonials, title: "Kind words", featuredOnly: true, limit: 6 } },
  { key: "newsletter", type: HomepageSectionType.newsletter, payload: { type: HomepageSectionType.newsletter, title: "First dibs on new drops", sub: "Join our list for new collections and studio stories." } },
  { key: "faq", type: HomepageSectionType.faq, payload: { type: HomepageSectionType.faq, title: "Frequently asked", limit: 6 } },
];

/**
 * Materialise the default homepage sections as editable rows — only when there
 * are currently zero rows (FR-8). No-ops otherwise. Returns the count created.
 */
export async function seedDefaultHomepage(): Promise<ActionResult<{ count: number }>> {
  const admin = await requireRole(ROLES);

  const count = await prisma.homepageSection.count();
  if (count > 0) {
    return fail("Your homepage already has sections. Edit them instead.");
  }

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      DEFAULT_SECTIONS.map((s, i) =>
        tx.homepageSection.create({
          data: {
            key: s.key,
            type: s.type,
            payload: s.payload as Prisma.InputJsonValue,
            isActive: true,
            sortOrder: (i + 1) * 10,
          },
        }),
      ),
    );
    await writeAudit({
      adminId: admin.id,
      action: "homepage_section.seed",
      entityType: "HomepageSection",
      entityId: "seed",
      after: { count: DEFAULT_SECTIONS.length },
    }, tx);
  });
  revalidateHomepage();
  return ok({ count: DEFAULT_SECTIONS.length });
}
