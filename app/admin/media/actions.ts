"use server";

import { z } from "zod";
import { Prisma, MediaType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/admin/audit";
import { ok, fail, type ActionResult } from "@/lib/result";
import { field, optionalField, intField } from "@/lib/admin/content-shared";
import type { ContentFormState } from "../content/_components/content-form-state";
import { formOk, formFail, formValidationFail } from "../content/_actions/shared";
import {
  cloudinaryEnabled,
  signUploadParams,
  destroyAsset,
  type SignedUpload,
} from "@/lib/cloudinary";

/**
 * Media library Server Actions (doc 15 §5.2 — content editors *consume* media;
 * the full library UX is owned by docs/11, but this MVP grid supports add-by-URL
 * + delete). Open to **all admins** (`requireAdmin`) per the nav model. Each
 * mutation validates, writes, `writeAudit("media_asset.*")`. No storefront cache
 * tag — media is referenced indirectly and busts via the consuming entity.
 */

/** Add-by-URL input (no upload pipeline in MVP). */
const addMediaSchema = z.object({
  url: z.string().trim().url("Enter a valid image URL.").refine((v) => /^https?:\/\//.test(v), "Must be an http(s) URL."),
  alt: z.string().trim().max(200).optional(),
  type: z.nativeEnum(MediaType).default(MediaType.image),
  width: z.number().int().min(0).optional(),
  height: z.number().int().min(0).optional(),
  /** Cloudinary public id (signed uploads only) — enables dedup + binary cleanup. */
  publicId: z.string().trim().max(255).optional(),
  folder: z.string().trim().max(80).optional(),
});

// ───────────────────────────── signUpload ─────────────────────────────

const signUploadSchema = z.object({
  folder: z.string().trim().max(120).optional(),
});

/**
 * Mint a one-shot signature for a signed, direct browser→Cloudinary upload
 * (docs/11 FR-13). Admin-gated so only authenticated staff can spend the account
 * quota; the API secret never leaves the server. The browser POSTs the file plus
 * these params straight to Cloudinary — bytes never transit our server. Returns a
 * friendly `fail` when Cloudinary isn't configured so the UI can degrade to
 * add-by-URL.
 */
export async function signUpload(raw: unknown): Promise<ActionResult<SignedUpload>> {
  await requireAdmin();
  if (!cloudinaryEnabled) {
    return fail("Image uploads aren't configured yet. Add an image by URL instead.");
  }
  const parsed = signUploadSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return fail("Couldn't prepare the upload. Please try again.");
  }
  const timestamp = Math.floor(Date.now() / 1000);
  try {
    return ok(signUploadParams({ timestamp, folder: parsed.data.folder }));
  } catch (err) {
    console.error("[media] sign upload failed", err);
    return fail("Couldn't prepare the upload. Please try again.");
  }
}

const auditSelect = {
  id: true,
  url: true,
  alt: true,
  type: true,
  width: true,
  height: true,
  folder: true,
  publicId: true,
} satisfies Prisma.MediaAssetSelect;

// ───────────────────────────── addMedia ─────────────────────────────

/** Register a media asset by URL. Form action (`useActionState`). */
export async function addMedia(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const admin = await requireAdmin();

  const typeRaw = optionalField(formData, "type");
  const parsed = addMediaSchema.safeParse({
    url: field(formData, "url"),
    alt: optionalField(formData, "alt"),
    type: typeRaw && typeRaw in MediaType ? typeRaw : undefined,
    width: intField(formData, "width"),
    height: intField(formData, "height"),
    publicId: optionalField(formData, "publicId"),
    folder: optionalField(formData, "folder"),
  });
  if (!parsed.success) {
    return formValidationFail(parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const after = await tx.mediaAsset.create({
        data: {
          url: input.url,
          alt: input.alt ?? null,
          type: input.type,
          width: input.width ?? null,
          height: input.height ?? null,
          publicId: input.publicId ?? null,
          folder: input.folder ?? null,
        },
        select: auditSelect,
      });
      await writeAudit(
        { adminId: admin.id, action: "media_asset.create", entityType: "MediaAsset", entityId: after.id, after },
        tx,
      );
      return after;
    });
    // `createdId` lets the single-image picker bind the new asset into its form.
    return { ...formOk("Media added to your library."), createdId: created.id };
  } catch (err) {
    console.error("[media] add failed", err);
    return formFail("Couldn't add that media. Please try again.");
  }
}

// ───────────────────────────── deleteMedia ─────────────────────────────

/**
 * Delete a media asset. Guarded: refuses when the asset is still referenced by a
 * product image/primary/og, category, collection, banner, testimonial, or the
 * site logo (the FKs `SetNull`, but we block to avoid silently un-setting a live
 * image). The caller passes the id; returns an `ActionResult`.
 */
export async function deleteMedia(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: {
      ...auditSelect,
      _count: {
        select: {
          productImages: true,
          primaryFor: true,
          ogFor: true,
          categories: true,
          collections: true,
          banners: true,
          testimonials: true,
          logoSettings: true,
        },
      },
    },
  });
  if (!asset) return fail("That media no longer exists.");

  const refs = Object.values(asset._count).reduce((a, b) => a + b, 0);
  if (refs > 0) {
    return fail("This image is still in use. Remove it from products/banners first.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.mediaAsset.delete({ where: { id } });
    const { _count, ...before } = asset;
    void _count;
    await writeAudit(
      { adminId: admin.id, action: "media_asset.delete", entityType: "MediaAsset", entityId: id, before },
      tx,
    );
  });

  // Best-effort: also remove the binary from Cloudinary so we don't accumulate
  // orphaned storage. Failure here never undoes the DB delete (already committed).
  if (asset.publicId) {
    await destroyAsset(asset.publicId);
  }
  return ok(undefined);
}
