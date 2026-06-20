# 18 — Decisions Log & Open Questions

> **Status:** 🟢 Stable · **Last updated:** 2026-06-13 · **Owner:** Product
>
> Triage of every question raised while authoring specs `01`–`17`. **Technical & consistency calls are decided and locked** in **CANON §16** (and supersede any conflicting spec detail). **Decisions that are genuinely the founder's** are in §3, each with a recommendation. **Content/assets the founder must supply** are in §4.

---

## 1. How questions were triaged

The 18 spec authors surfaced ~125 questions and notes. The large majority were *"decision taken — confirm"* (resolved inline with a sensible default). Consolidated, they fall into three buckets:

| Bucket | Meaning | Where it lives | Count |
|---|---|---|---|
| 🔒 **Locked** | Technical / consistency / mechanism call — resolved by the product owner | **CANON §16** | ~20 themes |
| 🙋 **Founder decision** | A genuine business / brand / risk judgment | **§3 below** | 7 |
| 📥 **Founder to provide** | Not a decision — required content, copy, or assets | **§4 below** | 8 |

**Net result: nothing in the suite is blocked.** Engineering can build the MVP against CANON today; the seven §3 items refine — they don't gate — the foundation, except **D-3 (launch scope)** which sets sequencing.

---

## 2. Locked resolutions (summary → CANON §16)

These are decided. Full text in CANON §16; condensed here for review.

| # | Was ambiguous | Now locked as |
|---|---|---|
| R-1 | Analytics ingest route (`/api/analytics/collect` vs `/api/track-event`) | **`/api/track-event`** |
| R-2 | When `order_confirmed` fires | **Server-side, on founder confirmation** (not buyer page-mount) |
| R-3 | Analytics data retention | **18 months raw / indefinite rollups**; order PII per tax law (~8 yrs) |
| R-4 | Free-shipping threshold field duplicated | **`shippingDefaults.freeShippingThresholdPaise`** is canonical |
| R-5 | Gift message on Order vs OrderItem | **Order-level primary**, per-item optional |
| R-6 | Customer identity key | **Phone (normalized, 91-prefixed)** unique; email non-unique |
| R-7 | Paginated `?page=N` indexing | **Indexable, self-canonical, `rel=prev/next`** |
| R-8 | Sold one-of-a-kind PDP | **Stays live as `out_of_stock`** with enquire/notify (SEO) |
| R-9 | Stock decrement at checkout | **No auto-decrement**; admin-managed; reservation → V1 |
| R-10 | DB host (Neon vs Supabase) | **Neon** |
| R-11 | `conversionRate` storage | **Integer basis points** |
| R-12 | Must a product be categorized to publish? | **Yes** (required for `status=active`) |
| + | Missing entities/fields/enums/routes/env | **Absorbed** into CANON §16.2–16.5 (`Redirect`, `Counter`, `PasswordResetToken`, `Order.clientRequestId`+fulfillment fields, `OrderItem` snapshots, `CmsPage.lastReviewedAt`, enum names, `/api/*` routes, Turnstile/bootstrap env) |

---

## 3. Founder decisions needed (with recommendations)

> **D-1, D-2, D-3 were decided on 2026-06-13** (see status column). D-4–D-7 carry a working default (build proceeds) and can be confirmed any time.

| # | Decision | My recommendation | Why it's yours / impact | Status |
|---|---|---|---|---|
| **D-1** | **Homepage 3D hero** — the current three.js animated gift hero is distinctive but heavy on mobile CWV and hosting cost. | _(I recommended optimize & keep)_ | Brand taste + performance/cost trade-off. Affects `02`, `05`, `09`, `16`. | ✅ **Replace with a lighter image/video hero** — drop `three`/R3F/Expo/RN deps (2026-06-13) |
| **D-2** | **Returns / refund stance** for handmade, made-to-order, often-personalized items. | _(I recommended custom-final + replace-damaged)_ | Business policy → drives the policy page + PDP/checkout copy + trust. | ✅ **Return window on ready-made items** (default **7 days**, unused/original condition); personalized & made-to-order = **final sale**; damaged/defective always replaced (2026-06-13) |
| **D-3** | **Launch scope gate** — what must be live to call it "launched". | **Ship the core MVP first**; coupons/GST/reviews/SMS in V1. | Sets the roadmap sequence (`17`). | ✅ **Ship core MVP first** — confirms roadmap `17` (2026-06-13) |
| **D-4** | **Admin owner 2FA (TOTP)** at launch vs V1. | **MVP** — admin is the only login and controls the whole business + customer PII. | Security/risk appetite. Affects `10`, `16`, `17`. | ⚪ default = MVP |
| **D-5** | **Launch KPI targets** (provisional: place-order CVR ≥1%, WhatsApp-close ≥60%, add-to-cart ≥8%). | **Adopt as directional**, re-baseline after 4 weeks live. | Your targets to own. Affects `01`, `13`. | ⚪ default set |
| **D-6** | **Analytics retention window** (DPDP) = 18 months raw. | **Confirm 18 mo** (covers festival YoY like Diwali); publish in Privacy Policy. | Privacy/legal policy call. Affects `13`, `15`, `16`. | ⚪ default = 18 mo |
| **D-7** | **WhatsApp first-response target** < 6 business hours. | **Adopt as an internal target** (not a public SLA). | Ops commitment that drives close-rate/trust. | ⚪ default set |

---

## 4. Founder to provide (content & assets — not decisions)

1. **Legal/policy text**, reviewed before launch: Privacy, Terms, Shipping & Delivery, Cancellation & Refund. (Specs `15` define structure & placeholders; the actual text is yours/your counsel's.)
2. **Returns policy wording** once **D-2** is chosen (incl. the handmade/personalized caveat).
3. **Brand/identity reconciliation** — confirm `googlywoogly.art`; the code currently **hardcodes** the WhatsApp number `91-6367851899` and Instagram `@googlywoogly_arrtt` and the project is named `my-v0-project`; specs drive these from `SiteSetting`. Confirm the real values + rename metadata (CANON-aligned brand).
4. **Real testimonials** (and, for the bulk page, **client logos + permission**) — placeholders used until provided.
5. **Product catalog + photography** — the model assumes Cloudinary-hosted imagery with alt text.
6. **GSTIN** — only when GST invoicing is enabled (V1).
7. **From-address / email domain** decision for deliverability (`orders@googlywoogly.art` + SPF/DKIM/DMARC).
8. **Logo + OG image** assets for metadata/social cards.

---

## 5. Per-document disposition

Every doc's own *Open Questions* section holds the full wording; this is the disposition summary.

| Doc | Raised | Disposition |
|---|---|---|
| `01` PRD | 8 | North-star (weekly *confirmed* orders) & revenue-requested locked; returns/SLA/KPIs → §3 (D-2/D-5/D-7); gift-message & PDP-OOS → R-5/R-8; brand mismatch → §4. |
| `02` Architecture | 6 | Neon, no-decrement, edge-collector, KV-in-V1 locked (R-9/R-10); 3D-hero → D-1. |
| `03` Data Model | 6 | Enum names + phone-identity + basis-points locked (R-6/R-11/§16.4); retention → R-3/D-6. |
| `04` IA & Routing | 7 | `Redirect` absorbed (§16.2); pagination → R-7; apex-canonical & flat category slugs adopted. |
| `05` Landing/Bulk | 8 | Closed section renderers, lead-budget-as-text, non-discount newsletter (coupons=V1) adopted; OOS-rail → R-8; brand → §4. |
| `06` Catalog/PLP | 9 | Material facet via `material:*` tags, LIMIT/OFFSET, pg_trgm adopted; pagination → R-7; wishlist shipped flagged-off. |
| `07` PDP/Recos | 7 | Heuristic recos MVP (`ProductAffinity`=V1, §16.2); OOS PDP → R-8; gift-msg → R-5; personalization fee → V2. |
| `08` Cart/Checkout | 7 | `clientRequestId` absorbed (§16.3); one note per line (MVP); free-ship field → R-4; phone-normalize → R-6. |
| `09` SEO/ISR | 7 | 300-product pre-render cap, dynamic OG, `rel=prev/next` adopted (§16.6/R-7); `/api/og`,`/api/revalidate` absorbed. |
| `10` Admin/Auth | 8 | Reset-token + lockout absorbed (§16.2); staff scope = fulfilment-only; 2FA → D-4; bootstrap env → §16.5. |
| `11` Product Mgmt | 8 | Category-required → R-12; alt-text warns; occasions curated+free-add; stock via AuditLog (typed ledger later); dnd-kit added. |
| `12` Orders | 6 | State-machine edges + fulfilment fields locked (§16.3); restock-on-cancel ON; GST `INV-{orderNumber}` (V1); PII retention → §4/D-6. |
| `13` Analytics | 8 | Route → R-1; `order_confirmed` → R-2; retention → R-3; soft-consent banner adopted; visitorId raw nanoid. |
| `14` Notifications | 7 | Resend + React Email + `EmailTemplateKey` set (§16.4); WhatsApp = analytics-only log; single sync attempt + manual resend (MVP). |
| `15` CMS/Legal | 7 | All 8 legal pages CMS-editable w/ fallback; Tiptap editor; AuditLog version trail; legal text authorship → §4. |
| `16` NFR | 8 | Retention → R-3/D-6; CSP report-only→enforced; Turnstile env absorbed; 2FA → D-4; remove 3D/Expo → D-1; ≥70% test bar. |
| `17` Roadmap | 7 | Single-engineer ~14–18wk plan; DLT-start-early & soft-launch recommended; launch-gate → D-3; 2FA-in-MVP → D-4. |

---

## 6. Change protocol

When a §3 decision is made: update this log's status, reflect it in **CANON** (and §16 if it changes the contract), then in the affected spec(s). Code is downstream of the docs — see `README.md` → *How to keep these docs in sync*.
