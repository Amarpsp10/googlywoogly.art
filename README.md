# GooglyWoogly Art — Handmade Gifts & Décor (e-commerce)

A production-grade, SEO-first commerce platform for a Jaipur-based handmade gifting & home-décor brand. Guest checkout that captures intent (no on-site payment — payment is arranged on WhatsApp after the founder confirms), a real-time admin command-center, and in-house analytics.

> **Status: complete & verified.** `next build` green · `pnpm lint` 0 errors · **409 unit tests pass** · runtime smoke-tested (security headers, auth gate, analytics ingest). Built phase-by-phase; full specs live in [`docs/`](./docs) (`docs/00-canonical-decisions.md` is the source of truth).

---

## Tech stack

Next.js 16 (App Router, RSC) · React 19 · TypeScript · Tailwind v4 + shadcn/ui · **PostgreSQL + Prisma 6** · custom JWT-cookie auth (`jose` + bcrypt) · Resend (email, via `fetch`) · in-house analytics · recharts · Vitest + Playwright. **Designed to run entirely on free tiers** (Neon, Cloudinary, Resend free, Vercel).

## Quick start

```bash
# 1. Prerequisites: Node 20+, pnpm, a local PostgreSQL 16 (or a Neon URL)
pnpm install

# 2. Env — copy and fill (local dev values already work out of the box if you
#    use the same local Postgres role/db as below)
cp .env.example .env        # then edit DATABASE_URL etc.

# 3. Database: migrate + seed sample catalog
pnpm prisma migrate deploy   # or: pnpm db:migrate (dev)
pnpm prisma db seed          # 8 products, categories, collections, admin, settings

# 4. Run
pnpm dev                     # http://localhost:3000
```

**Local DB used during development:** db `googlywoogly_dev`, role `googlywoogly` / `gw_dev_password` (see `.env`).
**Admin:** sign in at **`/admin-login`** with `admin@googlywoogly.art` / `ChangeMe!Admin123` (from `ADMIN_BOOTSTRAP_*`). **Change these before any real deploy.**

## Scripts

| Script | What |
|---|---|
| `pnpm dev` / `build` / `start` | Next dev / production build / serve |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint (flat config) |
| `pnpm test` / `test:watch` | Vitest unit tests |
| `pnpm db:migrate` / `db:seed` / `db:studio` | Prisma migrate / seed / studio |
| Playwright e2e | `npx playwright install chromium` once, then `npx playwright test` |

## What's implemented

- **Storefront** (`app/(shop)/*`): homepage, PLP `/products` (filters/sort/pagination), `/category/[slug]`, `/collections/[slug]`, PDP `/products/[slug]` (gallery, made-to-order messaging, personalization, recommendations, Product/Breadcrumb JSON-LD), `/search`, local-storage **cart** + drawer, `/checkout` (guest, no payment), `/order/confirmed/[token]`, `/track/[token]`, bulk-orders + contact, all legal pages, SEO (metadata, sitemap, robots, JSON-LD).
- **Orders & email**: `placeOrder` (transactional order number + tracking token, customer upsert, stock validation, idempotent), transactional email (Resend or dev-console), WhatsApp handoff.
- **Admin** (`app/admin/*`): JWT-cookie auth + RBAC, dashboard (KPIs/low-stock/pending), product+inventory editor, categories/collections, **order management** (status/payment transitions, timeline, ship+tracking, status emails), CMS (homepage/banners/testimonials/FAQ/pages/settings/media), CRM (inquiries/messages/customers/reviews), audit log.
- **Analytics**: privacy-safe client beacon + `/api/track-event`, nightly rollup (`/api/cron/rollup` + `vercel.json`), `/admin/analytics` (recharts funnel/traffic/devices), DPDP consent banner.
- **Hardening**: rate-limiting, Turnstile-ready forms, login lockout, security headers + report-only CSP, error/404 boundaries, a11y, e2e specs.

## Before launch — founder/owner to-dos

1. **Brand/contact**: confirm WhatsApp number, Instagram handle, and store details (Admin → Settings; some defaults seeded). Rename `package.json` `"name"` from `my-v0-project` if desired.
2. **Product photos**: images are URL-based today ($0, no setup). For uploads, add **Cloudinary** free-tier keys to `.env` (`CLOUDINARY_*`).
3. **Email**: add a **Resend** API key + verify the `googlywoogly.art` domain (SPF/DKIM/DMARC) and set `EMAIL_FROM`; without it, emails log to the console in dev.
4. **Legal copy**: review/replace the *draft* policy pages (`/privacy-policy`, `/terms`, `/shipping-policy`, `/returns-and-refunds`) with the founder/counsel.
5. **Security for prod**: regenerate `AUTH_SECRET` (`openssl rand -base64 32`), change the admin password, set `REVALIDATE_SECRET`/`CRON_SECRET`, and (optional) add Cloudflare **Turnstile** keys to enable bot-protection on forms.
6. **Deploy**: provision **Neon** (or any Postgres), set `DATABASE_URL` + `NEXT_PUBLIC_SITE_URL`, deploy to **Vercel** (or Cloudflare Pages for strictly-non-commercial-$0). Run `prisma migrate deploy` + seed settings/admin.

## Deferred (V1 / V2 — per `docs/00` §3)

Coupons, customer reviews activation, GST invoicing, **SMS** (needs India DLT registration), pincode serviceability, blog/journal, automated collections, abandoned-cart, on-site payment gateway, customer accounts/wishlist, product variants.

## Notable decisions (deviations noted vs `docs/`)

- **Prisma pinned to 6.x** (7.x's driver-adapter rearchitecture was too new for a reliable autonomous build).
- **Custom JWT-cookie auth** instead of Auth.js (single-admin credentials; fewer moving parts; add login 2FA later).
- **`(shop)` route group** so admin has its own shell; **`proxy.ts`** (Next 16) for the edge auth gate.
- See `docs/00-canonical-decisions.md` §16 and `docs/18-decisions-log.md` for the full decision log.
