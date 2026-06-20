import "server-only";
import { v2 as cloudinary } from "cloudinary";

/**
 * Server-only Cloudinary helper (docs/11 FR-13). Holds the API secret and is the
 * single place that talks to Cloudinary's admin/signing surface. Image bytes are
 * NEVER proxied through our server: the browser uploads straight to Cloudinary
 * using a short-lived signature minted here (`signUploadParams`), so we stay well
 * inside the free tier and serverless body limits. The public cloud name is the
 * only Cloudinary value that reaches the client (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`).
 *
 * Config precedence: explicit `CLOUDINARY_*` vars, falling back to the combined
 * `CLOUDINARY_URL` (cloudinary://key:secret@cloud) that the dashboard prints.
 */

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** Parse the combined `CLOUDINARY_URL` (cloudinary://key:secret@cloud) if present. */
function parseCloudinaryUrl(url: string | undefined): Partial<CloudinaryConfig> {
  if (!url) return {};
  const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(url.trim());
  if (!m) return {};
  return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
}

/** Resolve the active Cloudinary config (explicit vars win over CLOUDINARY_URL). */
function resolveConfig(): CloudinaryConfig | null {
  const fromUrl = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    fromUrl.cloudName ||
    "";
  const apiKey = process.env.CLOUDINARY_API_KEY || fromUrl.apiKey || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET || fromUrl.apiSecret || "";
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

const config = resolveConfig();

if (config) {
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });
}

/** True when the full server credential set is present (drives graceful fallback). */
export const cloudinaryEnabled = config !== null;

/** The folder uploads are organized under in the Cloudinary library. */
export const CLOUDINARY_FOLDER =
  process.env.CLOUDINARY_UPLOAD_FOLDER?.trim() || "googlywoogly/products";

/** Everything the browser needs to perform ONE signed upload. No secret here. */
export interface SignedUpload {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
}

/**
 * Mint a signature for a single direct browser upload (FR-13). The signature
 * covers EXACTLY the non-file params the client will send (`folder`, `timestamp`)
 * — Cloudinary recomputes it server-side and rejects any tampering. `timestamp`
 * is seconds; Cloudinary rejects signatures older than ~1h.
 */
export function signUploadParams(opts: {
  timestamp: number;
  folder?: string;
}): SignedUpload {
  if (!config) {
    throw new Error("Cloudinary is not configured.");
  }
  const folder = opts.folder?.trim() || CLOUDINARY_FOLDER;
  const signature = cloudinary.utils.api_sign_request(
    { timestamp: opts.timestamp, folder },
    config.apiSecret,
  );
  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    timestamp: opts.timestamp,
    folder,
    signature,
  };
}

/**
 * Permanently delete an asset from Cloudinary by `publicId` (best-effort cleanup
 * when a media asset is removed). Never throws into the caller — a failed remote
 * delete must not block the DB delete; it just leaves an orphan to GC later.
 */
export async function destroyAsset(publicId: string): Promise<boolean> {
  if (!config || !publicId) return false;
  try {
    const res = await cloudinary.uploader.destroy(publicId, { invalidate: true });
    return res.result === "ok" || res.result === "not found";
  } catch (err) {
    console.error("[cloudinary] destroy failed", publicId, err);
    return false;
  }
}

// Re-export the universal helpers so server callers have one import surface.
export {
  publicIdFromUrl,
  isCloudinaryUrl,
  UPLOAD_MAX_BYTES,
  UPLOAD_ALLOWED_MIME,
} from "./cloudinary-shared";
