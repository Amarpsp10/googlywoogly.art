"use client";

import * as React from "react";
import Image from "next/image";
import { UploadCloud, Loader2, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminLabel } from "@/components/admin/form-field";
import { signUpload, addMedia } from "@/app/admin/media/actions";
import { EMPTY_FORM_STATE } from "@/app/admin/content/_components/content-form-state";
import {
  UPLOAD_ACCEPT,
  UPLOAD_MAX_BYTES,
  UPLOAD_ALLOWED_MIME,
} from "@/lib/cloudinary-shared";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";
import { cn } from "@/lib/utils";

/** Client-side guard mirroring the server limits (fast feedback before signing). */
function validateImage(file: File): string | null {
  if (!(UPLOAD_ALLOWED_MIME as readonly string[]).includes(file.type)) {
    return "Unsupported type. Use PNG, JPG, WebP or AVIF.";
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    return `Too large — keep it under ${Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)} MB.`;
  }
  return null;
}

/**
 * `SingleImagePicker` — a compact, single-image field for admin forms (the
 * per-category tile and per-collection hero). Unlike the multi-image
 * `ProductMediaManager`, it owns exactly ONE image and writes the chosen
 * `MediaAsset` id into a hidden `<input name>` so the surrounding Server-Action
 * `<form>` persists it with the rest of the entity — no extra wiring in the
 * parent action.
 *
 * Upload flow (all client-side, bytes skip our server — docs/11 FR-13):
 *   `signUpload` (mint a signature) → `uploadToCloudinary` (direct browser→CDN,
 *   with progress + abort) → `addMedia` (register the `MediaAsset` row and return
 *   its id). The returned id becomes the hidden field's value. **Remove** clears
 *   the value + preview (the action then nulls the relation). Files are validated
 *   against the shared `UPLOAD_ALLOWED_MIME` / `UPLOAD_MAX_BYTES` limits before we
 *   spend a signature, mirroring the authoritative server checks.
 */
export function SingleImagePicker({
  name,
  defaultImageId,
  defaultImageUrl,
  label,
}: {
  /** Hidden input name — the form field the parent action reads (e.g. `imageId`). */
  name: string;
  /** Pre-selected `MediaAsset` id (edit forms); `null` on create. */
  defaultImageId?: string | null;
  /** Pre-selected image URL for the live preview; `null` when none is set. */
  defaultImageUrl?: string | null;
  /** Optional visible label rendered above the control. */
  label?: string;
}) {
  const [imageId, setImageId] = React.useState(defaultImageId ?? "");
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(defaultImageUrl ?? null);
  // `null` while idle; an integer 0–100 marks an in-flight upload.
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const uploading = progress !== null;
  const errorId = error ? `${name}-error` : undefined;

  // Abort any in-flight upload if the field unmounts mid-transfer.
  React.useEffect(() => () => abortRef.current?.abort(), []);

  const upload = React.useCallback(async (file: File) => {
    const invalid = validateImage(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    // Cancel a previous in-flight transfer (e.g. a quick re-pick) before starting.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setProgress(0);
    try {
      const signed = await signUpload({});
      if (!signed.ok) throw new Error(signed.error);

      const result = await uploadToCloudinary(file, {
        cloudName: signed.data.cloudName,
        signed: signed.data,
        resourceType: "image",
        onProgress: (pct) => setProgress(pct),
        signal: controller.signal,
      });

      // Register the asset as a MediaAsset row so the form can reference it by id.
      const fd = new FormData();
      fd.set("url", result.secureUrl);
      fd.set("type", "image");
      if (result.publicId) fd.set("publicId", result.publicId);
      if (result.width != null) fd.set("width", String(result.width));
      if (result.height != null) fd.set("height", String(result.height));
      const saved = await addMedia(EMPTY_FORM_STATE, fd);
      if (!saved.ok || !saved.createdId) {
        throw new Error(saved.message ?? "Couldn't save the image. Please try again.");
      }

      setImageId(saved.createdId);
      setPreviewUrl(result.secureUrl);
    } catch (err) {
      // A superseded/cancelled upload is not an error worth surfacing.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      // Clear progress only if this transfer is still the active one.
      if (abortRef.current === controller) {
        abortRef.current = null;
        setProgress(null);
      }
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (file) void upload(file);
  };

  const remove = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setImageId("");
    setPreviewUrl(null);
    setError(null);
    setProgress(null);
  };

  return (
    <div className="space-y-2">
      {label ? <AdminLabel>{label}</AdminLabel> : null}

      {/* The value the surrounding form submits. Empty string ⇒ the action nulls it. */}
      <input type="hidden" name={name} value={imageId} />

      {previewUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-2">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
            <Image src={previewUrl} alt="" fill sizes="80px" className="object-cover" />
            {uploading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
              </div>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="truncate text-sm text-muted-foreground">
              {uploading ? `Uploading… ${progress}%` : "Image set."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud className="size-4" aria-hidden /> Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={remove}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" aria-hidden /> Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label={`${label ?? "Image"} — drag and drop or click to upload`}
          aria-describedby={errorId}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !uploading) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!uploading) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50",
            uploading && "pointer-events-none opacity-60",
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="size-7 animate-spin text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">Uploading… {progress}%</p>
              <span className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </span>
            </>
          ) : (
            <>
              <UploadCloud className="size-7 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">
                Drag &amp; drop an image, or <span className="text-primary">browse</span>
              </p>
              <p className="text-xs text-muted-foreground">
                PNG · JPG · WebP · AVIF — up to {Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)} MB
              </p>
            </>
          )}
        </div>
      )}

      {/* Always-mounted file input so "Replace" works from the preview too. */}
      <input
        ref={fileInputRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        className="sr-only"
        aria-label={`Choose ${label ?? "an image"} to upload`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = ""; // allow re-picking the same file
        }}
      />

      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden /> {error}
        </p>
      ) : null}
    </div>
  );
}
