import type { SignedUpload } from "@/lib/cloudinary";

/**
 * Browser→Cloudinary direct upload helper (docs/11 FR-13). A plain, framework-free
 * module — NO `"use client"` and NO `"server-only"` — so any client component (the
 * product media manager today, the single-image pickers a later agent will build)
 * can import it. The image/video bytes go **straight to Cloudinary**, never through
 * our server, using a one-shot signature minted by the `signUpload` Server Action.
 *
 * The signature only covers `folder` + `timestamp` (see `lib/cloudinary.ts`), so the
 * SAME `signed` payload works for both image and video uploads — Cloudinary's
 * `resource_type` (`image` vs `video`) is a URL-PATH choice, not a signed body param.
 *
 * The `signed` arg is exactly the shape `signUpload` resolves with
 * (`ActionResult<SignedUpload>` → `.data`), imported as a type so this module stays
 * free of the server-only Cloudinary surface.
 */

/** The Cloudinary upload-response subset we consume, mapped to camelCase. */
export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
  width?: number;
  height?: number;
  bytes?: number;
  /** Seconds, videos only. */
  duration?: number;
  resourceType: "image" | "video";
};

/** Options for a single signed upload. `cloudName` targets the delivery account. */
export interface CloudinaryUploadArgs {
  /** Cloud name for the `/v1_1/<cloudName>/…` endpoint (use `signed.cloudName`). */
  cloudName: string;
  /** The signed params from the `signUpload` Server Action (`ActionResult<SignedUpload>.data`). */
  signed: SignedUpload;
  /** Cloudinary resource type → URL path segment. Defaults to `image`. */
  resourceType?: "image" | "video";
  /** Upload progress 0–100 (integer). */
  onProgress?: (pct: number) => void;
  /** Abort the in-flight XHR (e.g. the user removed the file). */
  signal?: AbortSignal;
}

/**
 * POST one file straight to Cloudinary with progress + abort support (bytes skip
 * our server). Resolves the mapped `CloudinaryUploadResult`, or rejects with a
 * friendly `Error` (or an `AbortError` `DOMException` when aborted).
 */
export function uploadToCloudinary(
  file: File,
  { cloudName, signed, resourceType = "image", onProgress, signal }: CloudinaryUploadArgs,
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload aborted.", "AbortError"));
      return;
    }

    const form = new FormData();
    form.append("file", file);
    form.append("api_key", signed.apiKey);
    form.append("timestamp", String(signed.timestamp));
    form.append("folder", signed.folder);
    form.append("signature", signed.signature);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText) as {
            secure_url: string;
            public_id: string;
            width?: number;
            height?: number;
            bytes?: number;
            duration?: number;
            resource_type?: string;
          };
          resolve({
            secureUrl: body.secure_url,
            publicId: body.public_id,
            width: body.width,
            height: body.height,
            bytes: body.bytes,
            duration: body.duration,
            resourceType: body.resource_type === "video" ? "video" : "image",
          });
        } catch {
          reject(new Error("Cloudinary returned an unexpected response."));
        }
      } else {
        let msg = `Upload failed (${xhr.status}).`;
        try {
          const errBody = JSON.parse(xhr.responseText);
          if (errBody?.error?.message) msg = errBody.error.message;
        } catch {
          /* keep default */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.onabort = () => reject(new DOMException("Upload aborted.", "AbortError"));

    if (signal) {
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(form);
  });
}
