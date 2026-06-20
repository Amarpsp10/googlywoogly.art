# GooglyWoogly Art — Documentation Suite

> **Project:** `vaani-gift-e-commerce` · **Brand:** GooglyWoogly Art · **Founder/CEO:** Vanshika Bhatia · **Base:** Jaipur, Rajasthan, India · **Domain:** `googlywoogly.art`
>
> **Market:** India-first (INR ₹, `en-IN`, IST) · **Model:** guest-only catalog + intent checkout · **Payment:** off-site via WhatsApp after the founder confirms.

---

## What this is

**GooglyWoogly Art** is a founder-led micro-brand selling handmade gifting and home-décor pieces designed and crafted in Jaipur — each item handcrafted, some made-to-order. This suite specifies a **production-grade, SEO-first commerce platform** built for that reality: a world-class server-rendered storefront where shoppers browse, build a client-side cart, and place an **intent-to-order via frictionless guest checkout (no login, no on-site payment)**; a real-time **admin command center** the founder runs largely from a phone to manage catalog, inventory, orders, content, and analytics; and a **WhatsApp + transactional-email** handoff where Vanshika confirms availability, collects payment off-site, and keeps the buyer updated. The architecture is deliberately lean for MVP — **no product variants, no payment gateway, no customer accounts** — yet modelled so each of those can be added later without rework.

These documents are the **buildable contract** for that platform: an engineer should be able to implement directly from them.

---

## How the documentation is organized

The suite reads as four layers, front to back — **foundation → storefront → admin & ops → synthesis**. Each layer assumes the ones before it.

| Layer | Docs | Purpose |
|---|---|---|
| **0 · Foundation** | `00`–`04` | The contract everything obeys: canonical decisions, product vision, architecture, data model, and information architecture / routing. Read these first; they define every entity name, enum, route, and cache tag the rest of the suite references. |
| **1 · Storefront** (customer-facing) | `05`–`09` | The public buying experience: landing & bulk-order, catalog/PLP/category/search, product detail, cart → checkout → order placement, and the SEO / rendering / ISR / revalidation strategy that ties it together. |
| **2 · Admin & Ops** (founder-facing) | `10`–`15` | The founder's command center: admin auth & dashboard, product/inventory/catalog management, order management & fulfillment, in-house analytics, notifications (email/SMS/WhatsApp), and CMS / static & legal pages. |
| **3 · Synthesis** (cross-cutting) | `16`–`18` | Requirements and plans that span the whole system: non-functional requirements (performance, security, a11y, reliability), the roadmap & delivery plan, and the decisions log of resolved & outstanding questions. |

**`00-canonical-decisions.md` is the single source of truth.** Entity names, fields, enums, routes, cache tags, money/locale conventions, and scope (MVP / V1 / V2) are defined there; every other doc conforms to it. Where a spec deviates, it implements its best decision and records the conflict under that doc's *Open Questions*.

---

## Document index

| Doc # | Title | What it covers | Primary audience |
|---|---|---|---|
| **00** | Canonical Decisions (CANON) | The single source of truth: entities, enums, routes, cache tags, conventions, scope, order state machine. | Everyone |
| **01** | Product Vision & PRD | Why this exists, who it serves, goals, personas, scope and success metrics. | Founder / Product |
| **02** | System Architecture & Tech Stack | Next.js 16 / RSC topology, Postgres + Prisma, Cloudinary, Vercel, services & boundaries. | Engineers / Architect |
| **03** | Data Model & Entities | Field-level schema, types, relations, indexes and derived fields for every entity. | Engineers / Architect |
| **04** | Information Architecture & Routing | Sitemap, URL design, navigation, render modes and route-level cache tags. | Engineers / Designers |
| **05** | Storefront: Landing & Bulk-Order Pages | Homepage sections, brand storytelling, and the corporate/bulk inquiry flow. | Product / Designers |
| **06** | Catalog: PLP, Category & Search | All-products and category list pages, faceted filter/sort/paginate, and search. | Product / Designers |
| **07** | Product Detail Page & Recommendations | PDP layout, handmade/made-to-order messaging, personalization, related products. | Product / Designers |
| **08** | Cart, Checkout & Order Placement | Client-side cart, guest checkout (contact + address, no payment), order creation. | Engineers / Product |
| **09** | SEO, Rendering, ISR & Revalidation | Structured data, metadata, ISR strategy, on-demand `revalidateTag` flows, sitemaps. | Engineers / SEO |
| **10** | Admin Foundation: Auth & Dashboard | Auth.js admin login, roles, layout shell, and the operational dashboard home. | Engineers / Product |
| **11** | Product, Inventory & Catalog Management | Admin CRUD for products, media, categories, collections, and stock/inventory states. | Founder / Product |
| **12** | Order Management & Fulfillment | Order detail, status & payment transitions, WhatsApp prefill, dispatch & tracking. | Founder / Ops |
| **13** | In-house Analytics & Reporting | Event capture, funnel, nightly rollups, KPI dashboards and operational alerts. | Product / Data |
| **14** | Notifications: Email, SMS & WhatsApp | Transactional email, WhatsApp click-to-chat, SMS (V1/DLT), templates & logging. | Engineers / Product |
| **15** | Content Management & Static / Legal Pages | CMS for homepage/banners/testimonials/FAQ/settings and required legal pages. | Founder / Content |
| **16** | Non-Functional Requirements | Performance (CWV), security, accessibility (WCAG AA), reliability, observability. | Engineers / Architect |
| **17** | Roadmap & Delivery Plan | Phased delivery sequence, dependency-ordered build plan, milestones and launch checklist across MVP → V1 → V2. | Delivery lead / Founder |
| **18** | Decisions Log & Open Questions | What was decided (and why), resolved cross-spec inconsistencies (CANON §16), and the business decisions still needing the founder. | Founder / Product |

---

## Recommended reading order

### For engineers
Build the mental model top-down, then go where you're assigned.

1. `00` Canonical Decisions — memorize names, enums, routes, cache tags, money/locale rules.
2. `02` System Architecture — runtime, services, boundaries.
3. `03` Data Model — the schema everything reads/writes.
4. `04` Information Architecture & Routing — render modes per route.
5. `09` SEO, Rendering, ISR & Revalidation — caching/revalidation contract that storefront work depends on.
6. **Then the area you own:** storefront → `05`–`08`; admin/ops → `10`–`15`.
7. `16` Non-Functional Requirements — the bar every feature must clear (performance, security, a11y, reliability). **Treat as a checklist throughout, not a final step.**

### For the founder / stakeholder
Start with the "why" and the parts you'll operate daily; skim the deep technical docs.

1. `01` Product Vision & PRD — the plan in plain terms.
2. `00` Canonical Decisions — §1–3 (business context, principles, scope) and §15 (key assumptions to confirm/override).
3. `05` Landing & Bulk-Order and `07` Product Detail — how customers experience the brand.
4. `12` Order Management & `11` Product/Inventory Management — your day-to-day command center.
5. `13` Analytics — the numbers you'll watch.
6. `14` Notifications and `15` CMS / Legal Pages — what's automated and what you control.

### For designers
Anchor on IA and the brand-facing surfaces; reference the contract for naming and states.

1. `04` Information Architecture & Routing — sitemap, navigation, page inventory.
2. `00` Canonical Decisions — §6 enums (the states UI must represent) and §10–11 (naming, India/handmade specifics).
3. `05` Landing & Bulk-Order → `06` Catalog/PLP → `07` Product Detail — the core storefront journey.
4. `08` Cart & Checkout — the conversion-critical flow.
5. `10` Admin Foundation — admin layout, navigation, and dashboard patterns.
6. `16` Non-Functional Requirements — accessibility (WCAG AA) and Core Web Vitals constraints on every design.

---

## Status legend

Each spec carries a status near its top. Use this shared vocabulary:

| Badge | Meaning |
|---|---|
| 🟢 **Stable** | Approved and buildable. Changes go through review and bump the *Last updated* date. |
| 🟡 **Draft** | Substantially complete but under active review; details may still move. |
| 🟠 **In progress** | Being written; not yet safe to build against. |
| ⚪ **Planned** | Scoped but not authored (e.g., doc `17`). |
| 🔵 **Superseded** | Replaced by a newer doc; kept for history. Links to its replacement. |

Scope tags used inside specs follow CANON §3: **MVP** (must ship) · **V1** (fast-follow) · **V2** (later) · **Out** (explicitly excluded now).

---

## How to keep these docs in sync

These specs are a living contract. To prevent drift:

1. **CANON wins.** `00-canonical-decisions.md` is authoritative for entity names, fields, enums, routes, cache tags, conventions, and scope. Never redefine these locally — reference them.
2. **Change CANON first.** A naming/enum/route/scope change lands in `00` *before* (or in the same change as) any dependent doc. Then update every doc that references it.
3. **Conflicts are logged, not silently resolved.** If a spec must deviate, implement the best decision **and** record it under that doc's *Open Questions* (and raise it against CANON §15).
4. **One concept, one home.** Field-level schema lives only in `03`; routing/render modes in `04`/`09`; notification templates in `14`. Other docs link rather than duplicate.
5. **Stamp every edit.** Update the doc's status badge and *Last updated* date on any material change; note what moved.
6. **Keep this index honest.** When a doc is added, retitled, or its scope/audience shifts, update the table and reading orders here in the same change.
7. **Code is downstream of docs.** When implementation reveals a better decision, push it back into the spec (and CANON if it's a contract) so the docs never lag the build.

---

## Open questions

All open questions surfaced while writing the suite have been triaged in **`18-decisions-log.md`**: technical / consistency calls are locked in **CANON §16 (Reconciliations & Addenda)**. **Decided 2026-06-13:** a lighter image/video hero (drop three.js), a **7-day return window on ready-made items only** (personalized / made-to-order are final sale), and **core-MVP-first** launch. Still open (working defaults in place): admin 2FA timing, KPI targets, and the 18-month data-retention window.
