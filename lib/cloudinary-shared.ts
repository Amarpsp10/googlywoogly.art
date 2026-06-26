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

/**
 * Video upload limits for the product media manager. Videos are uploaded via the
 * SAME signed flow as images (the Cloudinary `resource_type` is a URL-path choice,
 * not a signed param), then delivered progressively + poster-gated on the PDP. The
 * 100 MB ceiling keeps a single clip well within Cloudinary's free-tier per-asset
 * limit while still allowing a short, high-quality product reel.
 */
export const UPLOAD_VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
export const UPLOAD_VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm";
export const UPLOAD_VIDEO_ALLOWED_MIME = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
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

/**
 * Extract the Cloudinary **cloud name** (the path segment right after the host)
 * from a delivery URL. `<CldImage>` rebuilds its URL from a publicId and needs
 * the cloud name — by default it reads the build-time `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
 * env var, and if that is unset in an environment, next-cloudinary silently falls
 * back to its `ml_default` demo cloud and **404s every product image**. Passing the
 * cloud name parsed from the stored URL makes rendering independent of that env var.
 * Returns null for non-Cloudinary URLs.
 */
export function cloudNameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /res\.cloudinary\.com\/([^/]+)\/(?:image|video|raw)\/upload\//.exec(url);
  return m ? m[1] : null;
}

/**
 * Build a lightweight **poster frame** URL (a single JPG still) for a Cloudinary
 * video delivery URL, so the PDP gallery + the video player can show a thumbnail
 * without loading any video bytes. Pure string-building (no SDK), so it is safe to
 * call from the storefront gallery without pulling in the heavy video player. `so_0`
 * grabs the first frame; `c_limit,w_*` caps the width; `q_auto,f_jpg` keep it tiny.
 * Returns null for non-Cloudinary URLs (the caller renders a neutral placeholder).
 */
export function videoPosterUrl(
  url: string | null | undefined,
  width = 1080,
): string | null {
  const cloudName = cloudNameFromUrl(url);
  const publicId = publicIdFromUrl(url);
  if (!cloudName || !publicId) return null;
  const transform = `so_0,c_limit,w_${width},q_auto,f_jpg`;
  return `https://res.cloudinary.com/${cloudName}/video/upload/${transform}/${publicId}.jpg`;
}
