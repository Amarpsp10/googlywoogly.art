/**
 * End-to-end verification of the SIGNED browser-upload flow against the real
 * Cloudinary account — mirrors exactly what the admin dropzone does:
 *   1. sign {timestamp, folder} server-side with the API secret (lib/cloudinary)
 *   2. multipart POST the file + api_key + timestamp + folder + signature
 *   3. assert Cloudinary returns secure_url + public_id (+ dims)
 *   4. destroy the test asset so we leave no junk behind
 *
 * Run: node --env-file=.env scripts/verify-cloudinary.mjs
 */
import { v2 as cloudinary } from "cloudinary";

const cloudName =
  process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || "googlywoogly/products";

if (!cloudName || !apiKey || !apiSecret) {
  console.error("✗ Missing Cloudinary env vars (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET).");
  process.exit(1);
}
cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

// A real 1×1 PNG (red pixel).
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const bytes = Buffer.from(PNG_BASE64, "base64");

const timestamp = Math.floor(Date.now() / 1000);
const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, apiSecret);

const form = new FormData();
form.append("file", new Blob([bytes], { type: "image/png" }), "verify.png");
form.append("api_key", apiKey);
form.append("timestamp", String(timestamp));
form.append("folder", folder);
form.append("signature", signature);

console.log(`→ Uploading signed test image to cloud "${cloudName}", folder "${folder}"…`);
const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
  method: "POST",
  body: form,
});
const body = await res.json();

if (!res.ok) {
  console.error(`✗ Upload failed (${res.status}):`, body?.error?.message ?? body);
  process.exit(1);
}

console.log("✓ Upload OK");
console.log("  public_id :", body.public_id);
console.log("  secure_url:", body.secure_url);
console.log("  dimensions:", `${body.width}×${body.height}`, "| bytes:", body.bytes, "| format:", body.format);

// Confirm the delivery URL is actually reachable (CDN serves it).
const head = await fetch(body.secure_url, { method: "HEAD" });
console.log(`✓ Delivery URL reachable: HTTP ${head.status} (${head.headers.get("content-type")})`);

// Clean up the test asset.
const destroyed = await cloudinary.uploader.destroy(body.public_id, { invalidate: true });
console.log(`✓ Cleanup: destroy → ${destroyed.result}`);

console.log("\n✅ Cloudinary signed-upload flow verified end-to-end.");
