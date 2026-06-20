"use client";

import * as React from "react";
import {
  ArrowUp,
  ArrowDown,
  Star,
  Trash2,
  ImagePlus,
  ImageOff,
  UploadCloud,
  Loader2,
  AlertCircle,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminInput, AdminLabel } from "@/components/admin/form-field";
import { signUpload } from "@/app/admin/media/actions";
import {
  UPLOAD_ACCEPT,
  UPLOAD_MAX_BYTES,
  UPLOAD_ALLOWED_MIME,
} from "@/lib/cloudinary-shared";
import { cn } from "@/lib/utils";

/**
 * A product image in the form's working set (docs/11 FR-13/14/15). Images arrive
 * two ways: a signed drag-and-drop **upload** to Cloudinary (sets `publicId` +
 * dimensions), or a pasted **URL** (zero-config fallback). `mediaAssetId` is
 * undefined until the server upserts a `MediaAsset` on save. Reorder / set-primary
 * / alt are all keyboard-operable (no drag dependency) per a11y (FR-14, §4.10).
 */
export interface ProductImageDraft {
  /** Stable client key for React lists. */
  key: string;
  mediaAssetId?: string;
  url: string;
  alt: string;
  width?: number;
  height?: number;
  /** Cloudinary public id (uploads only) — enables dedup + cleanup on the server. */
  publicId?: string;
  sizeBytes?: number;
  isPrimary: boolean;
}

/** Parent passes React's state setter, so async uploads can use functional updates. */
type ImagesChange = (
  next: ProductImageDraft[] | ((prev: ProductImageDraft[]) => ProductImageDraft[]),
) => void;

let keySeq = 0;
function newKey(prefix = "img"): string {
  keySeq += 1;
  return `${prefix}-${keySeq}`;
}

/** Create a draft image from a pasted URL (first one becomes primary). */
export function makeImageDraft(url: string, isFirst: boolean): ProductImageDraft {
  return { key: newKey(), url: url.trim(), alt: "", isPrimary: isFirst };
}

/** The minimal Cloudinary upload response we consume. */
interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  width?: number;
  height?: number;
  bytes?: number;
}

/** An in-flight (or failed) upload shown in the dropzone while it completes. */
interface UploadTask {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "error";
  error?: string;
}

/** POST one file straight to Cloudinary with progress (bytes skip our server). */
function uploadToCloudinary(
  file: File,
  signed: {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    folder: string;
    signature: string;
  },
  onProgress: (pct: number) => void,
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", signed.apiKey);
    form.append("timestamp", String(signed.timestamp));
    form.append("folder", signed.folder);
    form.append("signature", signed.signature);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as CloudinaryUploadResult);
        } catch {
          reject(new Error("Cloudinary returned an unexpected response."));
        }
      } else {
        let msg = `Upload failed (${xhr.status}).`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body?.error?.message) msg = body.error.message;
        } catch {
          /* keep default */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(form);
  });
}

/** Client-side guard mirroring the server limits (fast feedback before signing). */
function validateFile(file: File): string | null {
  if (!(UPLOAD_ALLOWED_MIME as readonly string[]).includes(file.type)) {
    return `${file.name}: unsupported type. Use PNG, JPG, WebP or AVIF.`;
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    return `${file.name}: too large (max ${Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)} MB).`;
  }
  return null;
}

/**
 * `ProductMediaManager` — the media editor: drag-and-drop (or click) to upload
 * images to Cloudinary via a signed, direct browser upload, OR paste a URL. Set
 * the hero/primary, reorder with up/down, edit alt text inline, and remove.
 * Controlled by the parent form via `value` / `onChange`. When `uploadEnabled`
 * is false (no Cloudinary config) the dropzone is hidden and only URL paste shows.
 */
export function ProductMediaManager({
  value,
  onChange,
  maxImages = 12,
  uploadEnabled = false,
  folder,
}: {
  value: ProductImageDraft[];
  onChange: ImagesChange;
  maxImages?: number;
  uploadEnabled?: boolean;
  folder?: string;
}) {
  const [urlDraft, setUrlDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [showUrl, setShowUrl] = React.useState(!uploadEnabled);
  const [uploads, setUploads] = React.useState<UploadTask[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Live counts: how many slots remain across saved images + in-flight uploads.
  const activeUploads = uploads.filter((u) => u.status === "uploading").length;
  const remaining = maxImages - value.length - activeUploads;

  const setTask = (id: string, patch: Partial<UploadTask>) =>
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  const dropTask = (id: string) => setUploads((prev) => prev.filter((u) => u.id !== id));

  const handleFiles = React.useCallback(
    async (files: File[]) => {
      if (!uploadEnabled || files.length === 0) return;
      setError(null);

      // Respect the max across saved + in-flight; trim the overflow with a notice.
      let slots = maxImages - value.length - activeUploads;
      if (slots <= 0) {
        setError(`You can add up to ${maxImages} images.`);
        return;
      }
      const accepted: File[] = [];
      for (const file of files) {
        const invalid = validateFile(file);
        if (invalid) {
          setError(invalid);
          continue;
        }
        if (slots <= 0) {
          setError(`You can add up to ${maxImages} images — some files were skipped.`);
          break;
        }
        accepted.push(file);
        slots -= 1;
      }

      await Promise.all(
        accepted.map(async (file) => {
          const id = newKey("upl");
          setUploads((prev) => [
            ...prev,
            { id, name: file.name, progress: 0, status: "uploading" },
          ]);
          try {
            const res = await signUpload({ folder });
            if (!res.ok) throw new Error(res.error);
            const result = await uploadToCloudinary(file, res.data, (pct) =>
              setTask(id, { progress: pct }),
            );
            // Append via functional update so concurrent uploads don't clobber.
            onChange((prev) => {
              if (prev.length >= maxImages) return prev;
              if (result.public_id && prev.some((p) => p.publicId === result.public_id)) {
                return prev;
              }
              return [
                ...prev,
                {
                  key: newKey(),
                  url: result.secure_url,
                  alt: "",
                  width: result.width,
                  height: result.height,
                  publicId: result.public_id,
                  sizeBytes: result.bytes,
                  isPrimary: prev.length === 0,
                },
              ];
            });
            dropTask(id);
          } catch (err) {
            setTask(id, {
              status: "error",
              error: err instanceof Error ? err.message : "Upload failed.",
            });
          }
        }),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uploadEnabled, maxImages, value.length, activeUploads, folder, onChange],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    void handleFiles(files);
  };

  const addUrl = () => {
    const url = urlDraft.trim();
    if (!url) return;
    if (!/^https?:\/\/.+/i.test(url)) {
      setError("Enter a full image URL starting with http(s)://");
      return;
    }
    if (value.some((v) => v.url === url)) {
      setError("That image is already added.");
      return;
    }
    if (value.length >= maxImages) {
      setError(`You can add up to ${maxImages} images.`);
      return;
    }
    setError(null);
    const isFirst = value.length === 0;
    onChange([...value, makeImageDraft(url, isFirst)]);
    setUrlDraft("");
  };

  const setPrimary = (key: string) => {
    onChange(value.map((v) => ({ ...v, isPrimary: v.key === key })));
  };

  const setAlt = (key: string, alt: string) => {
    onChange(value.map((v) => (v.key === key ? { ...v, alt } : v)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remove = (key: string) => {
    const next = value.filter((v) => v.key !== key);
    // If we removed the primary, promote the first remaining image.
    if (next.length > 0 && !next.some((v) => v.isPrimary)) {
      next[0] = { ...next[0], isPrimary: true };
    }
    onChange(next);
  };

  const missingAlt = value.filter((v) => !v.alt.trim()).length;

  return (
    <div className="space-y-3">
      {/* Upload dropzone (signed direct-to-Cloudinary). Hidden with no config. */}
      {uploadEnabled && (
        <div className="space-y-2">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload images — drag and drop or click to choose files"
            onClick={() => remaining > 0 && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && remaining > 0) {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (remaining > 0) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
              dragging
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50",
              remaining <= 0 && "pointer-events-none opacity-50",
            )}
          >
            <UploadCloud className="size-7 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">
              {remaining > 0 ? (
                <>
                  Drag &amp; drop images, or <span className="text-primary">browse</span>
                </>
              ) : (
                `Image limit reached (${maxImages})`
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WebP or AVIF · up to {Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)} MB ·{" "}
              {Math.max(remaining, 0)} {remaining === 1 ? "slot" : "slots"} left
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={UPLOAD_ACCEPT}
              multiple
              className="sr-only"
              aria-label="Choose image files to upload"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                void handleFiles(files);
                e.target.value = ""; // allow re-picking the same file
              }}
            />
          </div>

          {/* In-flight / failed uploads */}
          {uploads.length > 0 && (
            <ul className="space-y-1.5">
              {uploads.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs"
                >
                  {u.status === "uploading" ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium">{u.name}</span>
                  {u.status === "uploading" ? (
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full bg-primary transition-all"
                          style={{ width: `${u.progress}%` }}
                        />
                      </span>
                      <span className="tabular-nums text-muted-foreground">{u.progress}%</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="text-destructive">{u.error}</span>
                      <button
                        type="button"
                        onClick={() => dropTask(u.id)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Dismiss ${u.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Add-by-URL row — primary path when uploads are off, a fold-out otherwise. */}
      {uploadEnabled && !showUrl ? (
        <button
          type="button"
          onClick={() => setShowUrl(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
        >
          <Link2 className="size-3.5" /> Or add an image by URL
        </button>
      ) : (
        <div className="space-y-1.5">
          <AdminLabel htmlFor="product-image-url">Add image by URL</AdminLabel>
          <div className="flex gap-2">
            <AdminInput
              id="product-image-url"
              type="url"
              inputMode="url"
              placeholder="https://…/photo.jpg"
              value={urlDraft}
              onChange={(e) => {
                setUrlDraft(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUrl();
                }
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "product-image-url-error" : undefined}
            />
            <Button type="button" variant="secondary" onClick={addUrl} className="shrink-0">
              <ImagePlus className="size-4" />
              Add
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <p id="product-image-url-error" role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : (
        !uploadEnabled && (
          <p className="text-xs text-muted-foreground">
            Paste a direct image link. The first image is the hero shot shown in
            search and on cards.
          </p>
        )
      )}

      {value.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
          <ImageOff className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">No images yet.</p>
        </div>
      ) : (
        <>
          {missingAlt > 0 ? (
            <p className="rounded-lg bg-accent/40 px-3 py-2 text-xs text-accent-foreground" role="status">
              {missingAlt} {missingAlt === 1 ? "image is" : "images are"} missing
              alt text — add it for SEO and screen readers.
            </p>
          ) : null}
          <ul className="space-y-2">
            {value.map((img, index) => (
              <li
                key={img.key}
                className="flex gap-3 rounded-xl border border-border bg-background p-2"
              >
                {/* Thumbnail (plain img: arbitrary external URLs, no next/image domain config). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt=""
                  className="size-16 shrink-0 rounded-lg border border-border object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                  }}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    {img.isPrimary ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                        <Star className="size-3 fill-current" /> Primary
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPrimary(img.key)}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-primary"
                      >
                        <Star className="size-3" /> Set primary
                      </button>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      <IconBtn
                        label="Move up"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </IconBtn>
                      <IconBtn
                        label="Move down"
                        disabled={index === value.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </IconBtn>
                      <IconBtn label="Remove image" onClick={() => remove(img.key)} destructive>
                        <Trash2 className="size-4" />
                      </IconBtn>
                    </div>
                  </div>
                  <AdminInput
                    aria-label={`Alt text for image ${index + 1}`}
                    placeholder="Describe this image…"
                    value={img.alt}
                    onChange={(e) => setAlt(img.key, e.target.value)}
                    className="h-9"
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  destructive,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors",
        "hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40",
        destructive && "hover:border-destructive hover:text-destructive",
      )}
    >
      {children}
    </button>
  );
}
