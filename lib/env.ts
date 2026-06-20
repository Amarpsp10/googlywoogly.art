/**
 * Public, browser-safe configuration and feature flags derived from env.
 * NOTE: never expose secrets here. Server code reads secrets directly from
 * `process.env` inside server-only modules.
 */

export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
  cloudinaryCloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
} as const;

/** Which optional integrations are configured (drives graceful degradation). */
export const features = {
  cloudinary: Boolean(process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_URL),
  email: Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST),
  turnstile: Boolean(process.env.TURNSTILE_SECRET_KEY),
} as const;
