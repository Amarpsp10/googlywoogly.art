/** @type {import('next').NextConfig} */

/**
 * Security headers + CSP (docs/16 FR-27 / §6.7).
 *
 * Most headers are static and identical everywhere; they are applied to all
 * routes. `X-Frame-Options` is the one exception — admin is `DENY` (never
 * framed), the storefront is `SAMEORIGIN` — so it's layered per-scope below.
 *
 * The Content-Security-Policy ships in **Report-Only** mode for the MVP
 * (docs/16 OQ-4): browsers report violations without blocking, so a policy
 * mistake can't break the storefront. It is tightened to enforcing (nonce-based)
 * in V1. The allow-list reflects exactly what the app loads:
 *   - images: self + Picsum + Cloudinary + data: (blur placeholders)
 *   - scripts: self + Vercel Analytics (`va.vercel-scripts.com`) + Turnstile
 *   - frames: Turnstile challenge iframe
 *   - connect: self + Vercel vitals + Turnstile siteverify
 *   - styles: self + 'unsafe-inline' (sonner/Tailwind inject runtime <style>)
 * `'unsafe-inline'`/`'unsafe-eval'` for scripts stay in the **Report-Only**
 * policy only (Next's hydration uses inline bootstrap scripts); the enforced V1
 * policy replaces them with a per-request nonce.
 */

const isProd = process.env.NODE_ENV === "production";

/** Report-Only CSP — permissive enough that nothing breaks, scoped to real origins. */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob: https://picsum.photos https://fastly.picsum.photos https://res.cloudinary.com",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "connect-src 'self' https://vitals.vercel-insights.com https://challenges.cloudflare.com https://api.cloudinary.com",
  "manifest-src 'self'",
].join("; ");

/** Headers shared by every route. */
const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Report-Only so a policy gap is observed, never enforced (docs/16 OQ-4).
  { key: "Content-Security-Policy-Report-Only", value: CONTENT_SECURITY_POLICY },
];

// HSTS only in production (never send max-age over plain-HTTP localhost).
if (isProd) {
  baseSecurityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  async headers() {
    return [
      {
        // Admin is never embeddable anywhere — hard DENY.
        source: "/admin/:path*",
        headers: [...baseSecurityHeaders, { key: "X-Frame-Options", value: "DENY" }],
      },
      {
        // Everything else (storefront, APIs): same-origin framing allowed.
        source: "/:path*",
        headers: [
          ...baseSecurityHeaders,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
