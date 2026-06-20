/**
 * Universal (server + client) Cloudinary helpers — pure functions and constants
 * with NO secret and NO SDK import, so the admin upload dropzone and the
 * storefront image component can share them. The secret-bearing surface lives in
 * the `server-only` `lib/cloudinary.ts`.
 */

/** Hard upload limits, enforced on BOTH the client and the signing server (FR-13). */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const UPLOAD_ACCEPT = "image/png,image/jpeg,image/webp,image/avif";
export const UPLOAD_ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
] as const;

/** Is this a Cloudinary delivery URL (vs a seed/Picsum/external one)? */
export function isCloudinaryUrl(url: string | null | undefined): boolean {
  return Boolean(url && /https?:\/\/res\.cloudinary\.com\//.test(url));
}

/**
 * Extract the Cloudinary `publicId` (incl. folder, no extension) from a delivery
 * URL, so the storefront can hand a clean id to `<CldImage>` for optimized
 * delivery. Returns null for non-Cloudinary URLs (seed/Picsum images), which the
 * caller renders with plain `next/image` instead.
 */
export function publicIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /res\.cloudinary\.com\/[^/]+\/(?:image|video|raw)\/upload\/(.+)$/.exec(url);
  if (!m) return null;
  // Drop transformation segments + a leading version (v123/) and the extension.
  let path = m[1];
  // A version segment marks the end of any transformation prefix.
  const v = path.match(/(?:^|\/)(v\d+)\//);
  if (v) {
    path = path.slice(path.indexOf(v[1]) + v[1].length + 1);
  }
  return path.replace(/\.[a-z0-9]+$/i, "");
}
