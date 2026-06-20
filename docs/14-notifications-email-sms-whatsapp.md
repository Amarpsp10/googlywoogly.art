# 14 — Notifications: Email, SMS & WhatsApp

> **Project:** `vaani-gift-e-commerce` · **Brand:** GooglyWoogly Art · **Domain:** `googlywoogly.art`
> **Owner perspective:** Product / Architect · **Conforms to:** [`00-canonical-decisions.md`](./00-canonical-decisions.md) (CANON)
> **Status:** Production blueprint. Entity fields → [`03`](./03-data-model-and-entities.md). Email/WhatsApp *triggers* in the order flow → [`08`](./08-cart-checkout-and-order-placement.md). Order lifecycle & admin transitions → `12` (consumes this doc). Architecture of the email/WhatsApp pipelines → [`02`](./02-system-architecture-and-tech-stack.md) §3.6–3.7.

This document is the **single contract for every outbound message** the platform sends — across **email**, **WhatsApp**, and (V1) **SMS** — for both the storefront (guest) and the admin (founder). It defines the **channel strategy**, the **provider decisions + deliverability setup**, the **complete transactional-email catalog** (every trigger, recipient, subject, content outline, and variables), the **`EmailTemplate` / `NotificationLog` data contracts**, the **WhatsApp click-to-chat deep-link generator**, the **admin new-order alerting** path, and the **DLT-gated SMS** plan. It is written so an engineer can implement `lib/email/*`, `lib/whatsapp.ts`, and the notification side-effects of every Server Action **directly**.

---

## 1. Purpose & Scope

### 1.1 What this document covers

- **Channel strategy & roles** (§3.1): **email = the automated transactional backbone (primary)**; **WhatsApp = founder concierge + payment + manual updates (click-to-chat, no API in MVP)**; **SMS = V1, DLT-gated**.
- **Provider decision & abstraction** (§3.2, §6): **Resend + React Email** primary, **Gmail SMTP via Nodemailer** zero-cost fallback, behind a single provider-agnostic mailer (`lib/email/send.ts`, selected by `EMAIL_PROVIDER`).
- **Deliverability** (§3.3): custom domain `googlywoogly.art`, **SPF / DKIM / DMARC**, from-address & reply-to policy, list-unsubscribe, warm-up, bounce/complaint posture.
- **The full transactional email catalog** (§3.4 + §4): `order_received_customer`, `order_received_admin`, `order_confirmed_customer`, `order_in_production_customer`, `order_shipped_customer`, `order_delivered_customer`, `order_cancelled_customer`, `order_on_hold_customer`, `review_request_customer` *(V1)*, `bulk_inquiry_ack`, `bulk_inquiry_admin`, `contact_ack`, `contact_admin`, `newsletter_welcome`, `admin_password_reset`, plus the **`pending_orders_digest_admin`** cron digest — each with trigger, recipient, subject, body outline, variables.
- **`EmailTemplate` model + variable conventions** (§5.1), and the **`NotificationLog`** lifecycle (status, retries, failures, idempotency) (§5.2, §7).
- **WhatsApp deep-link generator** (`lib/whatsapp.ts`, §4.10): `wa.me` + URL-encoded prefilled message builders for **ask-about-product (PDP)**, **customer order-placed handoff**, and **founder → customer status updates** (one-tap from admin per status).
- **Admin new-order alerting** (§4.6): the instant `order_received_admin` email + the daily `pending_orders_digest_admin` cron + in-app surfaces (owned by `10`).
- **SMS via MSG91 / Fast2SMS** (§3.5, §12): the **mandatory TRAI DLT registration + template-approval caveat**, the reserved `sms` channel (`skipped` no-op in MVP), and the V1 activation plan.
- **States/edge cases, analytics, acceptance, phasing** (§7–§12), incl. a **sequence diagram** for an order-status notification (§4.9).

### 1.2 What this document does NOT cover

- **The order state machine itself** (which transition is legal, who may trigger it) — that is CANON §7 and `12`. This doc owns **what message each transition sends and how**.
- **The checkout/placement transaction** (`placeOrder`) — owned by `08`. This doc owns the **send** that `08`’s post-commit step delegates here (`08` FR-34/FR-37) and the template bodies.
- **Email *capture* / consent UX** (newsletter form, contact form fields) — owned by `15`/`05`. This doc owns the **acknowledgement / welcome emails** those forms trigger.
- **Analytics ingestion internals** — owned by `13`. This doc only **emits** the CANON `whatsapp_click` (and `outbound_click`) events.
- **WhatsApp Business API automation** (templated/automated WhatsApp via Gupshup/Meta) — **V2**, explicitly out of MVP (CANON §3, §4). MVP WhatsApp is **deep links only**.
- **Push / web-push / in-app toasts** — admin in-app notification bell/toasts are owned by `10`; this doc owns only email/WhatsApp/SMS.

---

## 2. Primary user stories / jobs-to-be-done

| # | As a… | I want… | so that… |
|---|---|---|---|
| JTBD-1 | **Buyer (guest)** | an instant, branded email the moment I place an order, with my order number, items, total, a private tracking link, and a clear "pay on WhatsApp next" note | I trust the order landed and I know exactly what happens next — without any account. |
| JTBD-2 | **Buyer (guest)** | a one-tap WhatsApp button (pre-filled with my order details) on the confirmation screen and in my email | I reach the founder to confirm availability and pay, with zero typing. |
| JTBD-3 | **Buyer (guest)** | a clear email at each real milestone — confirmed, in production, shipped (with courier + tracking), delivered | I’m never left wondering about my handmade gift’s status. |
| JTBD-4 | **Founder (admin)** | an **instant email alert** on every new order (and a daily digest of anything still unconfirmed) | I act fast on WhatsApp and never miss a sale, even from my phone. |
| JTBD-5 | **Founder (admin)** | a **one-tap prefilled WhatsApp message** for each order status I set (confirm, in-production, shipped, delivered) | I send personal, correct updates in seconds without retyping order facts. |
| JTBD-6 | **Founder (admin)** | every email/WhatsApp/SMS attempt **logged** with status + failure reason, and a **resend** affordance | I can see what reached the customer and recover from provider outages. |
| JTBD-7 | **Founder (admin)** | a free/near-free email setup that still lands in the inbox (not spam) | the business runs sustainably with professional deliverability. |
| JTBD-8 | **Corporate buyer** | an immediate acknowledgement email after a bulk enquiry | I know my request was received and a quote is coming on WhatsApp/email. |
| JTBD-9 | **Architect / future dev** | a provider-agnostic mailer + a reserved `sms`/`whatsapp` channel | adding SMS (post-DLT) or WhatsApp Business API later is additive, not a rewrite. |
| JTBD-10 | **Compliance (DPDP / TRAI)** | minimal PII in messages, consent-based marketing, and SMS gated behind DLT | the brand stays lawful on data protection and Indian telecom rules. |

---

## 3. Detailed functional requirements

> Numbered, decisive, implementation-ready. **MUST** = MVP unless tagged `[V1]`/`[V2]`. Money is **integer paise** internally, formatted `₹`/`en-IN` for display; timestamps are **UTC** in DB, rendered **IST** in messages (CANON §10).

### 3.1 Channel strategy (the spine)

- **FR-1 — Three channels, three roles.**
  - **Email** is the **primary, automated, transactional** channel. It fires on every customer-facing order milestone and every lead acknowledgement, with **no human in the loop** (CANON §1: "Email carries automated transactional updates").
  - **WhatsApp** is the **founder concierge + payment + manual-update** channel, implemented as **`wa.me` click-to-chat deep links with URL-encoded prefilled text** (CANON §4). It is **human-initiated** — either the buyer taps a CTA, or the founder taps a one-click button in admin. **No automated/outbound WhatsApp messages in MVP** (no WhatsApp Business API until V2).
  - **SMS** is **V1 only**, MSG91/Fast2SMS, gated behind **mandatory TRAI DLT registration + pre-approved templates** (CANON §4, §11). In MVP the `sms` channel exists in the model but is a **no-op** (`NotificationStatus = skipped`).
- **FR-2 — Email is authoritative; WhatsApp is the conversation.** The system of record for "what the customer was told" is **email + the `OrderStatusEvent` timeline**. WhatsApp threads live in the founder’s phone and are **not** ingested. The platform only **deep-links into** WhatsApp and **logs the click** (`whatsapp_click`).
- **FR-3 — Every automated send is logged.** Every email (and every V1 SMS) attempt **MUST** write a **`NotificationLog`** row (CANON §5; `03` §3.7.7) — `channel`, `template`, `to`, `subject?`, `status`, `providerMessageId?`, `error?`, `orderId?`. WhatsApp deep-link generation is **not** a send (it produces a URL the human opens); it is **not** logged to `NotificationLog` but **is** captured as a `whatsapp_click` `AnalyticsEvent` when tapped (§9). *(Decision — see Open Q-1.)*
- **FR-4 — Notifications never block the primary action.** Sends are **fire-and-forget after the committing transaction** (`08` FR-37). A provider failure **MUST NOT** roll back an order/status change; it is caught, logged (`status='failed'`, Sentry), and surfaced for **resend** in admin (`12`).
- **FR-5 — `OrderStatusEvent` is the bridge.** When a customer-facing notification is sent for a status transition, the owning `OrderStatusEvent` records `channelNotified` (`NotificationChannel`) and `customerNotified=true` (CANON §5; `03` §3.7.2). If the founder chooses **not** to notify on a transition, `customerNotified=false` and `channelNotified=null`.

### 3.2 Email provider decision & abstraction

- **FR-6 — Primary provider: Resend + React Email.** Transactional email uses **Resend** as the sending provider and **React Email** (`@react-email/components`) to author templates as typed React components compiled to responsive HTML (CANON §4; `02` FR-23/FR-25). Resend free tier (transactional volume) is ample for a single-founder catalog.
- **FR-7 — Zero-cost fallback: Gmail SMTP via Nodemailer.** A **Nodemailer SMTP transport** to **Gmail** (`smtp.gmail.com:465`, app-password) is the fallback provider, selectable for local/dev or if the Resend account is unavailable. Same React-Email-rendered HTML is sent over SMTP. *(Gmail’s ~500 msg/day cap is acceptable as a fallback, not the primary — see Open Q-3.)*
- **FR-8 — One provider-agnostic mailer.** A single module **`lib/email/send.ts`** exposes `sendEmail(input: SendEmailInput): Promise<SendResult>` and selects the transport by **`EMAIL_PROVIDER`** (`resend | smtp`, default `resend`). Callers (Server Actions, services, cron) are **provider-agnostic** — they never import the Resend SDK or Nodemailer directly (`02` FR-23). The mailer:
  1. resolves the template (React Email component for code-defined templates; or `EmailTemplate` row for DB-overridable copy — §5.1),
  2. renders HTML + a **plaintext alternative** (always include `text/plain` for deliverability),
  3. sends via the selected transport,
  4. writes the `NotificationLog` row (FR-3) with the returned `providerMessageId` / error.
- **FR-9 — From/Reply-To from config.** The **From** address is `EMAIL_FROM` = `"GooglyWoogly Art <orders@googlywoogly.art>"` (`02` §12). `Reply-To` is set to **`SiteSetting.contactEmail`** so customer replies reach the founder’s real inbox even though the From is a no-reply-style sending mailbox. (See §3.3 for the address policy.)
- **FR-10 — Idempotent sends.** The mailer accepts an optional **`idempotencyKey`** (e.g. `order:{orderNumber}:{templateKey}`); a duplicate call with the same key within a short window MUST NOT send twice (guard via a `NotificationLog` lookup on `(orderId, template)` or a dedup store). This protects against Server-Action retries / double-submits (`08` FR-38).

### 3.3 Deliverability setup (custom domain, SPF/DKIM/DMARC)

- **FR-11 — Custom sending domain.** All transactional email is sent **from the brand domain** `googlywoogly.art` (never a shared/free domain). A dedicated **sending subdomain** is recommended: send from **`orders@googlywoogly.art`** with DNS auth on the root + (optionally) a `send.googlywoogly.art` subdomain for reputation isolation. *(Decision: use the root domain `orders@googlywoogly.art` for MVP simplicity; isolate to a subdomain only if volume/reputation later warrants — Open Q-2.)*
- **FR-12 — SPF / DKIM / DMARC are mandatory before go-live.** DNS on `googlywoogly.art` MUST include:

  | Record | Purpose | Value (shape) |
  |---|---|---|
  | **SPF** (`TXT @`) | authorizes Resend’s sending IPs | `v=spf1 include:_spf.resend.com ~all` (merge with any existing SPF — **one** SPF record only) |
  | **DKIM** (`CNAME`/`TXT`, Resend-provided) | cryptographic signature | the `resend._domainkey` (and `resend2…`) records from the Resend dashboard |
  | **DMARC** (`TXT _dmarc`) | alignment policy + reporting | start `v=DMARC1; p=none; rua=mailto:dmarc@googlywoogly.art; fo=1;` → tighten to `p=quarantine` then `p=reject` after monitoring |
  | **Return-Path / MAIL FROM** | bounce handling alignment | Resend custom MAIL FROM (`send.googlywoogly.art` MX/TXT) for SPF alignment |

  For the **Gmail SMTP fallback**, the From MUST remain `@googlywoogly.art` only if Gmail is configured with that domain (Google Workspace + its own SPF/DKIM); otherwise the fallback sends from the Gmail mailbox address with a clear From name. *(Decision: fallback is dev/emergency only; mismatched-domain fallback is acceptable for the rare outage — Open Q-3.)*
- **FR-13 — Deliverability hygiene.** Every email MUST: include a **plaintext part** (FR-8); use a **descriptive subject** (no ALL-CAPS/spam triggers); include the **physical business address** (`SiteSetting.businessAddress`) and brand identity in the footer; set a **`List-Unsubscribe`** header **on the newsletter/marketing class only** (transactional order emails are not unsubscribable and carry no marketing unsubscribe). Target **> 98% auth pass** (`01` KPIs).
- **FR-14 — Transactional vs marketing separation.** Order/lead **transactional** emails are sent regardless of newsletter opt-in (legitimate-interest service messages). **Marketing** email (newsletter, `review_request` is borderline — treated as transactional/service in V1) honors `NewsletterSubscriber.isActive` and includes unsubscribe. **No marketing content is appended to transactional order emails** beyond brand footer + a soft "follow us" line.
- **FR-15 — Bounce/complaint posture (MVP-lite, V1 webhook).** MVP: failures returned synchronously by the provider are logged (`NotificationLog.status='failed'`). `[V1]` Wire a **Resend webhook** (`POST /api/webhooks/resend`, signed) to capture async `bounced`/`complained`/`delivered` events and update `NotificationLog` + suppress hard-bounced addresses.

### 3.4 Transactional email catalog (overview)

- **FR-16 — Closed template-key set.** Every email is identified by a stable **`EmailTemplate.key`** (snake_case). The MVP/V1 set is **closed** (§4 details each):

  | Template key | Class | Recipient | Trigger | Phase |
  |---|---|---|---|---|
  | `order_received_customer` | transactional | customer | `placeOrder` commit (`status→pending_confirmation`) | **MVP** |
  | `order_received_admin` | ops-alert | founder (`SiteSetting.contactEmail`) | `placeOrder` commit | **MVP** |
  | `order_confirmed_customer` | transactional | customer | status → `confirmed` (notify=on) | **MVP** |
  | `order_in_production_customer` | transactional | customer | status → `in_production` (notify=on) | **MVP** |
  | `order_shipped_customer` | transactional | customer | status → `shipped` (notify=on) | **MVP** |
  | `order_delivered_customer` | transactional | customer | status → `delivered` (notify=on) | **MVP** |
  | `order_cancelled_customer` | transactional | customer | status → `cancelled` (notify=on) | **MVP** |
  | `order_on_hold_customer` | transactional | customer | status → `on_hold` (notify=on) | **MVP** *(opt-in send)* |
  | `bulk_inquiry_ack` | transactional | enquirer | `submitBulkInquiry` success | **MVP** |
  | `bulk_inquiry_admin` | ops-alert | founder | `submitBulkInquiry` success | **MVP** |
  | `contact_ack` | transactional | sender | `submitContact` success | **MVP** |
  | `contact_admin` | ops-alert | founder | `submitContact` success | **MVP** |
  | `newsletter_welcome` | marketing | subscriber | `subscribeNewsletter` (new active) | **MVP** |
  | `admin_password_reset` | transactional | admin | `requestPasswordReset` (`10` FR-18) | **MVP** |
  | `pending_orders_digest_admin` | ops-digest | founder | daily cron `/api/cron/pending-orders` | **MVP** |
  | `review_request_customer` | transactional | customer | N days after `delivered` (cron) | **V1** |

- **FR-17 — `ready_to_ship` has no customer email.** The `ready_to_ship` fulfillment status is **operational/internal** (CANON §7) — it does **not** send a customer email (the next customer-facing touch is `shipped`). It may still write an `OrderStatusEvent` with `customerNotified=false`.
- **FR-18 — Default notify-on-transition matrix.** The admin status-change UI (`12`) defaults the "Notify customer" toggle per transition; the founder can override per send:

  | Transition (to) | Customer email default | One-tap WhatsApp offered |
  |---|---|---|
  | `pending_confirmation` (on placement) | **auto-sent** (`order_received_customer`) | yes (handoff) |
  | `confirmed` | **on** (`order_confirmed_customer`) | yes (payment) |
  | `in_production` | **on** | yes |
  | `ready_to_ship` | **off** (internal) | optional |
  | `shipped` | **on** (`order_shipped_customer`) | yes (tracking) |
  | `delivered` | **on** (`order_delivered_customer`) | yes (thank-you) |
  | `cancelled` | **on** (`order_cancelled_customer`) | yes |
  | `on_hold` | **off by default** (opt-in) | yes |

### 3.5 SMS (V1, DLT-gated) — flagged caveat

- **FR-19 — SMS is NOT in MVP.** ⚠️ **Sending commercial/transactional SMS in India requires TRAI DLT (Distributed Ledger Technology) registration of the brand as a Principal Entity, header (sender-ID) registration, and **pre-approved message templates** with a mapped content template ID.** Until that is complete, **no SMS may be sent.** The `sms` `NotificationChannel` is **reserved** and behaves as a **no-op** in MVP: any attempt writes `NotificationLog{ channel:'sms', status:'skipped' }` (CANON §4, §11; `02` FR-27).
- **FR-20 — V1 SMS provider & gating.** `[V1]` SMS uses **MSG91** (primary) or **Fast2SMS** via `lib/sms/send.ts` behind the same provider-agnostic shape as email. It MUST refuse to send unless `MSG91_DLT_*` template IDs are configured and `SMS_ENABLED=true`. Each SMS template maps 1:1 to an **approved DLT template** (variable count + order must match the approval exactly).
- **FR-21 — V1 SMS scope (lean).** When enabled, SMS mirrors only the **highest-value, lowest-frequency** milestones to respect cost + DLT scope: **order placed** (order no. + track link), **confirmed/payment**, **shipped** (courier + tracking), **delivered**. Each is a registered transactional DLT template. Marketing SMS is **out of scope**.

### 3.6 WhatsApp (click-to-chat deep links)

- **FR-22 — Deep-link generator.** `lib/whatsapp.ts` exposes pure builders that return a `wa.me` URL:
  `https://wa.me/{number}?text={encodeURIComponent(body)}` where `number = SiteSetting.whatsappNumber` (E.164 digits, no `+`; CANON env `WHATSAPP_NUMBER`) (CANON §4; `02` FR-26; `08` §4.5). The body is built from order/product context and **always URL-encoded**.
- **FR-23 — Three deep-link intents.** The generator MUST support:
  1. **`askAboutProduct(product)`** — buyer → founder from PDP ("Ask on WhatsApp"): pre-fills product title + URL + a question stub.
  2. **`orderPlacedHandoff(order)`** — buyer → founder from the confirmation page + order email: pre-fills order number, line items (title × qty — lineTotal, personalization in parens), grandTotal, customer name (the exact body in `08` §4.5).
  3. **`founderStatusUpdate(order, status)`** — founder → customer from admin (`12`): opens a chat **to the customer’s phone** (`https://wa.me/{order.customerPhone}?text=…`) pre-filled with a per-status message (confirm/payment, in-production, shipped + tracking, delivered) (§4.10).
- **FR-24 — WhatsApp click analytics.** Every WhatsApp CTA tap emits a **`whatsapp_click`** `AnalyticsEvent` with context (`productId` or order ref in `metadata`, never raw PII) (CANON §6, §12; `08` §9; §9 here).
- **FR-25 — Number presence guard.** If `SiteSetting.whatsappNumber` is empty, WhatsApp CTAs are **hidden** (not broken `wa.me` links), and the admin dashboard shows the "Add your WhatsApp number in Settings" setup nag (`10` FR-42). Order emails then omit the WhatsApp CTA and lean on the tracking link + reply-to.

### 3.7 Admin new-order & operational alerting

- **FR-26 — Instant new-order email.** On `placeOrder` commit, an **`order_received_admin`** email MUST be sent to `SiteSetting.contactEmail` with the order facts + a deep link to `/admin/orders/[id]` (`08` FR-34). This is the founder’s primary "act now" trigger.
- **FR-27 — Daily pending-orders digest.** A **Vercel Cron** `GET /api/cron/pending-orders` (~09:00 IST, `CRON_SECRET`-gated) sends a **`pending_orders_digest_admin`** email summarizing orders stuck in `pending_confirmation` (and `on_hold`) older than a threshold, plus low-stock products, so nothing rots un-actioned (`02` §6.2/§14.2). It writes a `NotificationLog` row.
- **FR-28 — In-app surfaces are owned by `10`.** The admin notifications **bell**, sidebar **badges**, and dashboard **queues/alert strip** are specified in `10` (FR-32/FR-33/FR-38/FR-42). This doc owns only the **email** half of admin alerting.

---

## 4. UX / UI breakdown — message-by-message

> These are **messages**, not pages; the "UI" is the rendered email and the WhatsApp prefill. All emails are **single-column, ~600px, mobile-first** React Email layouts with: a brand header (logo + "GooglyWoogly Art"), a clear H1, body, a primary CTA button, and a footer (business address, contact, social, brand line "Handmade in Jaipur, India 🇮🇳"). Copy is **warm, handmade, founder-led, en-IN**; emojis used sparingly (✨ 💬 📦). Colors honor the pink/playful brand at **WCAG AA contrast** (CANON §4). Every CTA is also printed as a **plaintext URL** (so it survives plaintext clients and can be saved). Currency is `₹`/`en-IN`; dates IST.

### 4.0 Shared email anatomy

```
┌───────────────────────────────────────────────┐
│  [GooglyWoogly Art logo]                       │  ← header (brand pink bg, AA contrast)
├───────────────────────────────────────────────┤
│  H1: {contextual headline}                     │
│  Hi {customerName}, …                          │  ← greeting (or generic if none)
│  {body — order/line/status content}            │
│                                                │
│  [  PRIMARY CTA BUTTON  ]                       │  ← e.g. Track order / Continue on WhatsApp
│  or visit: https://…                           │  ← plaintext fallback URL
├───────────────────────────────────────────────┤
│  Footer:                                        │
│  GooglyWoogly Art · Handmade in Jaipur 🇮🇳      │
│  {businessAddress} · {contactEmail}            │
│  WhatsApp · Instagram · {social}               │
│  (newsletter only) Unsubscribe                 │
└───────────────────────────────────────────────┘
```

**Order-bearing emails** render a **line-item table** (thumbnail, title, qty, lineTotal; personalization/gift note as a sub-line) + a totals block (subtotal, shipping (or "FREE"), discount[V1], GST[V1], **grand total**) + the shipping address. All from **`OrderItem` snapshots** (never re-queried from `Product`) so the email is frozen-accurate (`03` FR-11).

### 4.1 `order_received_customer` (MVP) — the placement email

- **Trigger:** `placeOrder` commit (`08` FR-34). Recipient: `Order.customerEmail`.
- **Subject:** `Order GW-2026-00042 received ✨ — we’ll confirm on WhatsApp`
- **H1:** "Thank you, {customerName}! Your order is in."
- **Body:** "We’ve received your order and saved it. **Each piece is handmade**, so the next step is a quick WhatsApp chat where we confirm availability (and any made-to-order lead times) and share **secure payment details**. **No payment was taken on the site.**"
  - Line-item table + totals + shipping address (§4.0).
  - Any **made-to-order** lines call out `productionLeadTimeDays` ("Made to order · ships in ~{n} days").
  - Gift message echoed if present.
- **Primary CTA:** **💬 Continue on WhatsApp** → `orderPlacedHandoff` deep link (`whatsappUrl`).
- **Secondary CTA:** **🔗 Track your order** → `trackingUrl` (`/track/[token]`), also printed as text.
- **Reassurance line:** "What happens next: 1) We confirm on WhatsApp · 2) You pay securely via WhatsApp · 3) We craft & ship pan-India."

### 4.2 `order_received_admin` (MVP) — the founder alert

- **Trigger:** `placeOrder` commit. Recipient: `SiteSetting.contactEmail`.
- **Subject:** `🛎️ New order GW-2026-00042 — ₹2,897 — Aanya Sharma`
- **Body (scannable, ops-first):** order number, time (IST), **customer name + phone + email**, full line items, **grand total**, shipping address, `customerNote?`, `giftMessage?`, flags (made-to-order mix? gift?).
- **Primary CTA:** **Open in admin** → `/admin/orders/[id]` (`adminOrderUrl`).
- **Secondary CTA:** **Message {customerName} on WhatsApp** → `founderStatusUpdate(order, 'pending_confirmation')` deep link (to the customer’s phone) so the founder can act straight from the email on a phone.

### 4.3 `order_confirmed_customer` (MVP)

- **Trigger:** status → `confirmed` with notify=on (`12`). Subject: `Order GW-2026-00042 confirmed ✅`
- **Body:** "Great news — your order is **confirmed**! {If made-to-order: We’re starting your handmade pieces; estimated dispatch in ~{leadDays} days.} {Payment instructions / status as the founder notes.}"
- **Payment instructions block (conditional):** if `paymentStatus ∈ {unpaid, awaiting_payment}`, include a "**Complete your payment on WhatsApp**" CTA (`founder`/payment deep link) + the grand total. If `paid`, show "Payment received — thank you!" instead.
- **CTA:** Track order + Continue on WhatsApp.

### 4.4 `order_in_production_customer` (MVP)

- **Trigger:** status → `in_production`. Subject: `We’re crafting your order ✨ (GW-2026-00042)`
- **Body:** handmade-story tone — "Your pieces are now being **handcrafted in our Jaipur studio**." Show estimated dispatch from `productionLeadTimeDays` if present. CTA: Track order.

### 4.5 `order_shipped_customer` (MVP) — courier + tracking

- **Trigger:** status → `shipped`. Subject: `Your order is on its way 📦 (GW-2026-00042)`
- **Body:** "Dispatched! Your order is on its way." Render **courier name** + **tracking number** (and a **carrier tracking URL** if provided) — these come from the founder’s note/fields on the `shipped` transition (`12` captures `courierName`, `trackingNumber`, `trackingUrl` into the `OrderStatusEvent.note` / structured fields).
- **CTA:** **Track shipment** (carrier URL if present, else `/track/[token]`). The internal tracking page also shows the courier/tracking (`12`).

### 4.6 `order_delivered_customer` (MVP)

- **Trigger:** status → `delivered`. Subject: `Delivered! We hope you love it 💝 (GW-2026-00042)`
- **Body:** warm thank-you, care-instructions reminder (handmade), "reply on WhatsApp if anything’s not perfect." Soft "share a photo / follow us" line. `[V1]` seeds the later `review_request`.

### 4.7 `order_cancelled_customer` & `order_on_hold_customer` (MVP)

- **`order_cancelled_customer`** — Subject: `Order GW-2026-00042 cancelled`. Empathetic; reason (founder note) optional; "any payment made will be refunded — we’ll sort it on WhatsApp"; CTA: WhatsApp + shop again.
- **`order_on_hold_customer`** — **opt-in** (off by default). Subject: `A quick update on your order GW-2026-00042`. Neutral "we’ve paused to sort out {reason}; we’ll update you shortly."

### 4.8 Lead & account emails (MVP)

- **`bulk_inquiry_ack`** — to enquirer. Subject: `We’ve received your bulk enquiry — GooglyWoogly Art`. "Thanks {name}! We’ll get back with a quote on WhatsApp/email shortly." Echoes quantity/occasion/deadline if provided. CTA: WhatsApp.
- **`bulk_inquiry_admin`** — to founder. Subject: `🏢 New bulk enquiry — {company/name} ({quantity} pcs)`. Full enquiry fields + CTA `/admin/bulk-inquiries`.
- **`contact_ack`** — to sender. Subject: `Thanks for reaching out — GooglyWoogly Art`. "We’ll reply soon." CTA: WhatsApp/FAQ.
- **`contact_admin`** — to founder. Subject: `✉️ New contact message — {subject|name}`. Body + CTA `/admin/messages`.
- **`newsletter_welcome`** — to subscriber. Subject: `Welcome to GooglyWoogly Art ✨`. Brand intro; **includes List-Unsubscribe + footer unsubscribe** (marketing class). Sent only on a **new active** subscription (idempotent on `email`).
- **`admin_password_reset`** — to admin (`10` FR-18). Subject: `Reset your GooglyWoogly Admin password`. Single-use link `/admin/reset-password?token=…`, 30-min expiry, "ignore if you didn’t request this." **No brand-marketing footer** (security email).

### 4.9 `review_request_customer` (V1) & `pending_orders_digest_admin` (MVP cron)

- **`review_request_customer`** `[V1]` — cron N days after `delivered` (default **5 days**), once per order, only if `delivered` and not already reviewed. Subject: `How did we do? Review your GooglyWoogly order ✨`. Deep-links to a per-product review form (token-scoped, `Review.orderId` verifies purchase; `03` §3.7.4). Treated as transactional/service; suppressed if the customer opted out.
- **`pending_orders_digest_admin`** (MVP) — daily cron. Subject: `⏳ {n} orders awaiting your confirmation`. Bulleted list (order no., customer, age, total, paymentStatus) + low-stock count, each deep-linked into admin.

### 4.9.1 Sequence diagram — an order-status notification (shipped)

```mermaid
sequenceDiagram
  autonumber
  actor Founder
  participant ADMIN as Admin order detail (12)
  participant SA as transitionOrderStatus (Server Action)
  participant SVC as Order service
  participant DB as Postgres (Prisma)
  participant MAIL as Mailer (lib/email/send)
  participant RESEND as Resend / SMTP
  participant WA as WhatsApp (wa.me)
  actor Customer

  Founder->>ADMIN: set status → shipped (+ courier, tracking no.)<br/>Notify customer = ON
  ADMIN->>SA: transitionOrderStatus({orderId, to:'shipped', note, notify:true})
  SA->>SA: requireAdmin() + Zod validate
  SA->>SVC: applyTransition(order, 'shipped', actor)
  SVC->>DB: tx { UPDATE Order.status='shipped';<br/>INSERT OrderStatusEvent(status, note, changedByAdminId,<br/>channelNotified='email', customerNotified=true) }
  DB-->>SVC: committed
  Note over SA,MAIL: side-effects AFTER commit (never roll back the order)
  SA->>MAIL: sendEmail(order_shipped_customer, {courier,tracking,trackingUrl,…},<br/>idempotencyKey=order:{no}:shipped)
  MAIL->>MAIL: render React Email → HTML + text
  MAIL->>RESEND: send
  alt provider OK
    RESEND-->>MAIL: { id: providerMessageId }
    MAIL->>DB: INSERT NotificationLog(status='sent', providerMessageId)
  else provider error
    RESEND-->>MAIL: error
    MAIL->>DB: INSERT NotificationLog(status='failed', error)
    MAIL-->>SA: failure (logged; surfaced for resend in 12)
  end
  SA-->>ADMIN: { ok:true } (toast; optimistic)
  ADMIN-->>Founder: shows "emailed ✓" + one-tap "Message on WhatsApp"
  opt founder also pings on WhatsApp
    Founder->>WA: tap deep link founderStatusUpdate(order,'shipped')
    WA-->>Customer: prefilled chat (order no. + courier + tracking)
    ADMIN->>DB: whatsapp_click AnalyticsEvent
  end
  Note over Customer: receives email → taps Track shipment (carrier/track link)
```

### 4.10 WhatsApp prefilled message bodies (`lib/whatsapp.ts`)

> All bodies are URL-encoded; kept short; **never include full address or email** in WhatsApp text (the order already has it). Built from `OrderItem` snapshots.

**(a) Ask about product (PDP → founder)** — `askAboutProduct(product)`:
```
Hi GooglyWoogly Art! 👋 I’m interested in "{product.title}".
{NEXT_PUBLIC_SITE_URL}/products/{product.slug}
Could you tell me more about availability & customization?
```

**(b) Order placed (confirmation/email → founder)** — `orderPlacedHandoff(order)` — exactly `08` §4.5:
```
Hi GooglyWoogly Art! 👋 I just placed an order.

Order: GW-2026-00042
Items:
• Hand-painted Mug × 2 — ₹1,598  (Engrave: Aanya)
• Brass Diya Set × 1 — ₹1,299  (made to order)
Total: ₹2,897

Name: Aanya Sharma
Please confirm availability & share payment details. Thank you!
```

**(c) Founder → customer status updates** — `founderStatusUpdate(order, status)` → chat to `order.customerPhone`. Per-status body:

| Status | Prefilled body (to customer) |
|---|---|
| `pending_confirmation` | `Hi {firstName}! 👋 This is GooglyWoogly Art about your order {orderNumber}. We’re confirming availability and will share secure payment details here shortly. 🙏` |
| `confirmed` | `Hi {firstName}! ✅ Your order {orderNumber} (₹{grandTotal}) is confirmed. Here’s how to pay securely: {…}. Thank you!` |
| `in_production` | `Hi {firstName}! ✨ We’ve started handcrafting your order {orderNumber}. Estimated dispatch in ~{leadDays} days.` |
| `shipped` | `Hi {firstName}! 📦 Your order {orderNumber} has shipped via {courier}. Tracking: {trackingNumber} {trackingUrl}` |
| `delivered` | `Hi {firstName}! 💝 Your order {orderNumber} was delivered. We hope you love it! Reply here if anything isn’t perfect.` |
| `cancelled` | `Hi {firstName}, your order {orderNumber} has been cancelled. {reason} Any payment will be refunded — let’s sort it here.` |

> These mirror the email subjects/bodies so the customer gets a consistent message regardless of channel. The founder edits freely in WhatsApp before sending (the prefill is a starting point).

### 4.11 Admin notification surfaces (this doc’s slice)

- **Order detail (`12`) "Notify customer" control:** per transition, a toggle (defaulted per FR-18) + a preview of the email subject + a **one-tap WhatsApp** button. After send: an inline status chip — **"Emailed ✓ {time}"** / **"Email failed — Resend"** (reads latest `NotificationLog` for that `(orderId, template)`).
- **Resend affordance:** "Resend email" re-invokes the mailer with the same template + a fresh `NotificationLog` row (no order mutation).
- **Notification history (per order):** a small list on the order detail showing each `NotificationLog` (channel icon, template, to, status, time) — read-only timeline of what was sent.
- **Mobile:** all controls are single-tap, ≥44px; the WhatsApp button opens the native app via `wa.me`.

---

## 5. Data & entities used

> CANON `03` names verbatim. **R** = read, **W** = written.

| Entity | R/W | Fields / notes |
|---|---|---|
| **`NotificationLog`** | **W** (every send) / **R** (admin history, idempotency) | `id, orderId?, channel(NotificationChannel), template, to, subject?, status(NotificationStatus), providerMessageId?, error?, createdAt`. One row per email/SMS attempt. Idempotency lookup on `(orderId, template)`. |
| **`EmailTemplate`** | **R** (DB-overridable subjects/copy), **W** (admin/seed) | `id, key(U), subject, htmlBody, variables[]`. Seeded for every key in §3.4; React-Email components are the rendering source, `EmailTemplate` provides **founder-editable subject/copy overrides** (§5.1). |
| **`Order`** | **R** | `orderNumber, trackingToken, status, paymentStatus, customerName, customerPhone, customerEmail, shippingAddress, subtotal, shippingFee, discountTotal, taxTotal, grandTotal, currency, couponCode?, customerNote?, giftMessage?, confirmedAt`. Source of all order-email variables. |
| **`OrderItem`** | **R** | `productTitle, sku, imageUrl, unitPrice, quantity, lineTotal, personalizationNote?, giftMessage?` — **snapshots** drive the line table (`03` FR-11). |
| **`OrderStatusEvent`** | **W** (by `12`, consumed here) | `status, note?, changedByAdminId?, channelNotified(NotificationChannel?), customerNotified(bool)`. Set `channelNotified`/`customerNotified` when this doc sends (FR-5). |
| **`Product`** | **R** | `title, slug` for `askAboutProduct` and (V1) `review_request` deep links. Never reads `costPrice`. |
| **`BulkInquiry`** | **R** | `name, company?, phone, email, quantity?, occasion?, deadline?, message` for ack/admin emails. |
| **`ContactMessage`** | **R** | `name, email, subject?, message` for ack/admin emails. |
| **`NewsletterSubscriber`** | **R** | `email, isActive` to gate `newsletter_welcome` + marketing. |
| **`SiteSetting`** | **R** | `storeName, contactEmail, whatsappNumber, socialLinks, businessAddress, logoId`. `contactEmail` = admin alert recipient + `Reply-To`; `whatsappNumber` = deep-link target. |
| **`AdminUser`** | **R** | `email` for `admin_password_reset` (token flow owned by `10`). |
| **`Customer`** | **R** (V1) | for review-request targeting / suppression. |
| **`AnalyticsEvent`** | **W** | `whatsapp_click` (+ `outbound_click`) on WhatsApp/social CTA taps (§9). |

**No new entity is introduced by this spec.** `NotificationLog` + `EmailTemplate` (CANON §5) fully cover it. *(WhatsApp deep links are URLs, not persisted sends — Open Q-1.)*

### 5.1 `EmailTemplate` model + variable conventions

- **FR-29 — React Email is the renderer; `EmailTemplate` is the override layer.** Each template’s **layout/structure** is a code-defined **React Email component** (`lib/email/templates/{key}.tsx`) — versioned, type-checked, testable. The DB **`EmailTemplate`** row (keyed by `key`) holds the **founder-editable `subject` and any copy blocks** (intro/outro) + the declared **`variables[]`**; the renderer merges DB copy + variables into the component. If no `EmailTemplate` row exists for a key, the component’s built-in defaults are used (the app **never** fails to send for a missing row). *(Decision — see Open Q-4.)*
- **FR-30 — Variable interpolation contract.** `EmailTemplate.subject`/copy use **`{{variable}}`** placeholders restricted to the keys declared in `variables[]`. The mailer validates (Zod) that every required variable is supplied before send; a missing required variable is a **`skipped`** log + Sentry (never a broken `{{…}}` in a live email). Variable values are HTML-escaped in HTML, raw in plaintext.
- **FR-31 — Canonical variable set per template** (the contract `08` §9.1 already fixed for the placement emails, extended here):

  | Template key | Required variables |
  |---|---|
  | `order_received_customer` | `customerName, orderNumber, items[{title,qty,unitPrice,lineTotal,personalizationNote?,isMadeToOrder,leadDays?}], subtotal, shippingFee, discountTotal, taxTotal, grandTotal, currency, shippingAddress, trackingUrl, whatsappUrl, storeName` |
  | `order_received_admin` | `orderNumber, placedAtIST, customerName, customerPhone, customerEmail, items[…], subtotal, shippingFee, grandTotal, shippingAddress, customerNote?, giftMessage?, adminOrderUrl, whatsappCustomerUrl` |
  | `order_confirmed_customer` | `customerName, orderNumber, grandTotal, paymentStatus, paymentInstructions?, trackingUrl, whatsappUrl, leadDays?` |
  | `order_in_production_customer` | `customerName, orderNumber, leadDays?, estimatedDispatchIST?, trackingUrl` |
  | `order_shipped_customer` | `customerName, orderNumber, courierName, trackingNumber, carrierTrackingUrl?, trackingUrl, items[…]` |
  | `order_delivered_customer` | `customerName, orderNumber, whatsappUrl, careNote?` |
  | `order_cancelled_customer` | `customerName, orderNumber, reason?, whatsappUrl` |
  | `order_on_hold_customer` | `customerName, orderNumber, reason?, whatsappUrl` |
  | `bulk_inquiry_ack` | `name, company?, quantity?, occasion?, deadlineIST?, whatsappUrl, storeName` |
  | `bulk_inquiry_admin` | `name, company?, phone, email, quantity?, occasion?, budget?, deadlineIST?, message, adminInquiryUrl` |
  | `contact_ack` | `name, storeName, whatsappUrl, faqUrl` |
  | `contact_admin` | `name, email, phone?, subject?, message, adminMessageUrl` |
  | `newsletter_welcome` | `storeName, shopUrl, unsubscribeUrl` |
  | `admin_password_reset` | `resetUrl, expiryMinutes` |
  | `pending_orders_digest_admin` | `pendingCount, orders[{orderNumber,customerName,ageHours,grandTotal,paymentStatus,adminOrderUrl}], lowStockCount, adminUrl` |
  | `review_request_customer` *(V1)* | `customerName, orderNumber, items[{title,reviewUrl}], storeName` |

- **FR-32 — Shared formatting helpers.** Variables are formatted via shared codecs before interpolation: money via `lib/money.formatINR` (paise→`₹`/`en-IN`), dates via `lib/datetime` (UTC→IST, `en-IN`), addresses via a shared `formatAddress` (CANON §10; `02` FR-9/FR-10). Templates **never** format money/dates inline.

### 5.2 `NotificationLog` lifecycle

- **FR-33 — One row per attempt, status-driven.** A `NotificationLog` row is created for every email/SMS attempt with `status` transitioning `queued → sent | failed | skipped` (CANON §6). `system`-channel rows MAY record purely internal notifications (e.g., a digest) if not tied to a customer address. `providerMessageId` stores Resend/MSG91 id; `error` stores the provider/exception message (no secrets, PII-light).
- **FR-34 — `skipped` semantics.** `skipped` is logged when a send is **intentionally not performed**: SMS in MVP (FR-19), missing required variable (FR-30), empty/invalid recipient, or a suppressed/hard-bounced address `[V1]`. `skipped` is **not** an error — it’s an auditable "we chose not to send."
- **FR-35 — Retries.** MVP: a single synchronous attempt; failure → `failed` + manual **Resend** in admin (FR-28/§4.11). `[V1]`: a bounded **retry queue** (Upstash/Vercel KV, `02` §16.3) auto-retries `failed` transient sends (e.g., 3 attempts, exponential backoff), each attempt updating/appending a log; permanent failures (hard bounce) suppress the address.

---

## 6. Server actions / API routes, mailer & generators

> This doc’s logic is mostly **side-effects of other domains’ actions** (placement in `08`, status in `12`, leads in `08`/`15`) plus the **mailer**, the **WhatsApp generator**, and the **cron digest**. Inputs are Zod-validated; outputs are the discriminated `{ ok }` result (`02` §6.1).

### 6.1 Mailer & generators (library surface)

| Symbol | Module | Input (typed) | Output | Side effects |
|---|---|---|---|---|
| `sendEmail` | `lib/email/send.ts` | `{ templateKey, to, variables, replyTo?, idempotencyKey?, class:'transactional'\|'marketing'\|'ops' }` | `{ ok:true, providerMessageId } \| { ok:false, error }` | render (React Email) → send (Resend/SMTP) → write `NotificationLog` |
| `renderEmail` | `lib/email/render.ts` | `{ templateKey, variables }` | `{ html, text, subject }` | merges `EmailTemplate` overrides + component |
| `sendSms` *(V1)* | `lib/sms/send.ts` | `{ dltTemplateKey, to, variables }` | `{ ok, providerMessageId } \| skipped` | MSG91/Fast2SMS; refuses unless `SMS_ENABLED` + DLT IDs set; writes `NotificationLog{channel:'sms'}` |
| `waAskAboutProduct` | `lib/whatsapp.ts` | `{ product:{title,slug} }` | `string` (`wa.me` URL to `WHATSAPP_NUMBER`) | none (pure) |
| `waOrderPlacedHandoff` | `lib/whatsapp.ts` | `{ order, items }` | `string` (URL to `WHATSAPP_NUMBER`) | none (pure) |
| `waFounderStatusUpdate` | `lib/whatsapp.ts` | `{ order, status, extras? }` | `string` (URL to `order.customerPhone`) | none (pure) |

> The WhatsApp builders are **pure functions usable in both RSC (render the CTA href) and client islands (rebuild on the fly)**; they read `WHATSAPP_NUMBER`/`SiteSetting.whatsappNumber` passed in (never import Prisma). `analytics.emit('whatsapp_click', …)` fires on the client tap (§9), not in the builder.

### 6.2 Notification calls embedded in domain actions

| Calling action (owner) | This doc’s send(s) | Recipients | Revalidates |
|---|---|---|---|
| `placeOrder` (`08`) | `order_received_customer` + `order_received_admin` (post-commit, FR-4) | customer + `SiteSetting.contactEmail` | **none** (cart/checkout/track uncached — `08` §5; CANON §9) |
| `transitionOrderStatus` (`12`) | the per-status customer email if `notify=true` (FR-18) + set `OrderStatusEvent.channelNotified/customerNotified` | customer | **none** (admin SSR; `/track` is `no-store`) |
| `setPaymentStatus` (`12`) | *(no automatic email)* — payment changes are reflected in the next status email / WhatsApp; optional manual notify | — | none |
| `resendNotification` (`12`) | re-send a given `(orderId, template)` | per template | none |
| `submitBulkInquiry` (`08`/`15`) | `bulk_inquiry_ack` + `bulk_inquiry_admin` | enquirer + founder | none |
| `submitContact` (`15`) | `contact_ack` + `contact_admin` | sender + founder | none |
| `subscribeNewsletter` (`15`) | `newsletter_welcome` (only if newly active) | subscriber | none |
| `requestPasswordReset` (`10`) | `admin_password_reset` | admin | none |

### 6.3 Route handlers / cron

| Route | Method | Runtime | Auth | Action | NotificationLog |
|---|---|---|---|---|---|
| `/api/cron/pending-orders` | GET | Node | `CRON_SECRET` (Bearer) | build digest of stale `pending_confirmation`/`on_hold` + low-stock → send `pending_orders_digest_admin` to `contactEmail` | 1 row (`channel:'email'`/`system`) |
| `/api/cron/review-requests` *(V1)* | GET | Node | `CRON_SECRET` | find orders `delivered` ≥ N days, not yet requested → send `review_request_customer` | 1 row/order |
| `/api/webhooks/resend` *(V1)* | POST | Node | Resend signature | update `NotificationLog` on async `delivered`/`bounced`/`complained`; suppress hard bounces | updates rows |

> All cron routes verify `Authorization: Bearer $CRON_SECRET` and return fast (`02` §14.2). Schedules live in `vercel.json`.

---

## 7. States & edge cases

| Case | Behavior |
|---|---|
| **Email provider down (Resend)** | Send caught → `NotificationLog.status='failed'` + Sentry; **order/status change still succeeds** (FR-4). Founder still has the WhatsApp CTA + admin **Resend**. `[V1]` auto-retry + SMTP failover via `EMAIL_PROVIDER` switch. |
| **Both providers down** | Order placement/transition unaffected; logs `failed`; admin shows "Email failed — Resend"; the customer still reached confirmation + WhatsApp on placement. |
| **Missing/invalid recipient email** | `skipped` log; no send; admin alert email still goes to `contactEmail`. (Customer email is NN at checkout — `08` FR-17 — so this is rare.) |
| **Missing required variable** | `renderEmail` validation fails → `skipped` + Sentry; **no broken `{{var}}` ever ships** (FR-30). |
| **Duplicate send (action retry / double-submit)** | `idempotencyKey` + `(orderId, template)` lookup prevents a second identical email (FR-10); `08` FR-38 idempotency upstream also dedups the order. |
| **`whatsappNumber` not configured** | WhatsApp CTAs hidden everywhere; order emails omit the WhatsApp button (lean on tracking link + Reply-To); admin setup nag shown (`10` FR-42, FR-25). |
| **Customer phone invalid for founder→customer WhatsApp** | `waFounderStatusUpdate` still builds a `wa.me/{digits}` link; if digits are non-numeric/empty the admin button is disabled with a tooltip "Add a valid phone to message on WhatsApp." |
| **Status set with notify=OFF** | No email; `OrderStatusEvent.customerNotified=false`, `channelNotified=null`; admin chip shows "Not notified." |
| **`ready_to_ship` transition** | No customer email by default (FR-17); internal event only. |
| **SMS attempted in MVP** | `lib/sms/send` returns `skipped`; `NotificationLog{channel:'sms',status:'skipped'}`; no provider call (DLT not done — FR-19). |
| **DLT template mismatch (V1)** | If variable count/order ≠ approved template, MSG91 rejects → `failed`; the send is refused client-side if `MSG91_DLT_*` missing. |
| **Newsletter re-subscribe** | `newsletter_welcome` sent **only** on transition to a **new active** subscriber; re-subscribing an existing active email does not re-welcome (idempotent on `email`). |
| **Hard bounce / spam complaint (V1)** | Resend webhook → suppress address; future sends to it `skipped`; transactional order emails still attempt once (legitimate interest) but respect a hard-bounce suppression. |
| **GST enabled mid-life (V1)** | Order emails render `taxTotal` from the **order snapshot**, not live settings (`03` §7 GST toggle). |
| **Template copy edited in admin** | Next send uses the new `EmailTemplate.subject`/copy; already-sent emails are immutable; `AuditLog` records the edit (`10`). |
| **Email rendering exception** | Caught in `renderEmail`; `failed`/`skipped` log; never throws into the order transaction (post-commit boundary). |
| **Reply-to loop** | `Reply-To = contactEmail`; the From `orders@` mailbox is monitored/auto-archived to avoid a loop; customer replies land in the founder’s real inbox. |

---

## 8. SEO / performance / accessibility

> Notifications are not indexable pages; the relevant concerns are **deliverability, email accessibility, and the WhatsApp/track link hygiene**.

- **Deliverability (the "SEO of email"):** SPF/DKIM/DMARC (FR-12), plaintext part (FR-8), real business address + identity, low spam-trigger subjects, List-Unsubscribe on marketing only (FR-13/FR-14). Track address auth pass-rate (> 98%, `01`).
- **Email accessibility (WCAG):** semantic headings, sufficient color contrast (AA) on the pink brand, **alt text on all images** (logo, product thumbnails — from `OrderItem.imageUrl`/`ProductImage.alt`), legible ≥14px body, **never convey info by color alone** (status also stated in words), CTAs are real `<a>` buttons with descriptive text (not "click here"), and a **plaintext URL** beside every button. Dark-mode-safe colors where feasible.
- **Performance:** emails are lightweight HTML (no web fonts blocking; system/email-safe fonts; Cloudinary `f_auto,q_auto` thumbnails sized for email). Mailer renders server-side; sends are async/non-blocking (FR-4). React Email output is inlined-CSS, table-based for client compatibility.
- **Privacy-by-design (DPDP):** WhatsApp deep links **omit address/email** from the prefilled text (FR-23); analytics events carry **no raw PII** (`whatsapp_click` uses ids/hashes — `08` §9); `trackingToken` links are `noindex` and unguessable (CANON §10). No tracking pixels beyond the (optional, V1) Resend open/click metrics; **no third-party email trackers**.
- **Tracking-link hygiene:** the `/track/[token]` URL in emails is the **canonical absolute** URL from `NEXT_PUBLIC_SITE_URL`; it is `noindex,nofollow` (`09` FR-22) so forwarded emails never leak an indexable order page.

---

## 9. Analytics events emitted

> Only CANON **`AnalyticsEventType`** values (CANON §6; `13` owns ingestion). This doc emits:

| Event | Emitted when | Payload (PII-light) |
|---|---|---|
| `whatsapp_click` | any `wa.me` CTA tapped — PDP "Ask on WhatsApp", confirmation/email handoff, admin founder→customer button | `metadata { context: 'pdp'\|'order_handoff'\|'admin_status', status?, productId? }`, `productId?`; **no phone/email** |
| `outbound_click` | social/external links in email footer or site chrome | `metadata { destination }` |

- **No email-specific CANON event exists** (the enum is closed). Email **sends/outcomes** are tracked operationally via **`NotificationLog`** (not `AnalyticsEvent`). Email **open/click** metrics, if enabled `[V1]`, come from Resend’s dashboard/webhook — not the in-house funnel.
- `place_order` / `order_confirmed` analytics are emitted by `08`/`12` at their triggers, not duplicated here.

---

## 10. Acceptance criteria

A reviewer can mark this spec "met" when:

- [ ] **AC-1.** A single provider-agnostic `sendEmail` (`lib/email/send.ts`) sends via **Resend** when `EMAIL_PROVIDER=resend` and **Gmail SMTP (Nodemailer)** when `=smtp`; callers never import a provider SDK directly.
- [ ] **AC-2.** Every email send writes **exactly one** `NotificationLog` row with `channel`, `template`, `to`, `status ∈ {queued,sent,failed,skipped}`, `providerMessageId?`/`error?`, and `orderId?` where applicable.
- [ ] **AC-3.** `googlywoogly.art` has **SPF, DKIM, DMARC** configured; From = `EMAIL_FROM` (`orders@googlywoogly.art`); `Reply-To = SiteSetting.contactEmail`; every email includes a **plaintext part** + business address.
- [ ] **AC-4.** On `placeOrder` commit, **two** emails fire — `order_received_customer` (customer) and `order_received_admin` (`contactEmail`) — and an **email failure does not roll back the order** (`08` FR-37).
- [ ] **AC-5.** Each customer-facing **order status transition** with notify=on sends its mapped template (`order_confirmed_customer` … `order_cancelled_customer`) per the §3.4 / FR-18 matrix, sets `OrderStatusEvent.channelNotified='email'` + `customerNotified=true`, and `ready_to_ship` sends **no** customer email.
- [ ] **AC-6.** All money in emails is `₹`/`en-IN` from integer paise via the shared codec; all dates are **IST**; line items render from **`OrderItem` snapshots** (not live `Product`).
- [ ] **AC-7.** `lib/whatsapp.ts` builds correct `wa.me` URLs for **askAboutProduct** (to `WHATSAPP_NUMBER`), **orderPlacedHandoff** (to `WHATSAPP_NUMBER`, exact `08` §4.5 body), and **founderStatusUpdate** (to `order.customerPhone`, per-status body); all text is URL-encoded and **omits full address/email**.
- [ ] **AC-8.** Tapping any WhatsApp CTA emits a **`whatsapp_click`** `AnalyticsEvent` with no raw PII; missing `whatsappNumber` **hides** the CTAs (no broken links).
- [ ] **AC-9.** Admin order detail (`12`) exposes per-transition **Notify customer** + **one-tap WhatsApp**, a post-send **status chip** from the latest `NotificationLog`, and a working **Resend** action.
- [ ] **AC-10.** The **SMS channel is a no-op in MVP**: any SMS attempt logs `channel='sms', status='skipped'` with **no** provider call; the DLT caveat is documented; `lib/sms/send` refuses to send unless `SMS_ENABLED` + `MSG91_DLT_*` are set (`[V1]`).
- [ ] **AC-11.** `EmailTemplate` rows are seeded for every key in §3.4; a **missing row never blocks a send** (component defaults used); a **missing required variable** yields `skipped` + Sentry, **never** a broken `{{var}}` in a live email.
- [ ] **AC-12.** Lead/account emails fire on their triggers: `bulk_inquiry_ack`/`_admin`, `contact_ack`/`_admin`, `newsletter_welcome` (only on new active sub, with unsubscribe + List-Unsubscribe), `admin_password_reset` (single-use link, 30-min expiry, no marketing footer).
- [ ] **AC-13.** The daily `/api/cron/pending-orders` digest sends `pending_orders_digest_admin` to `contactEmail`, guarded by `CRON_SECRET`, and logs a `NotificationLog` row.
- [ ] **AC-14.** Emails meet **WCAG AA** (contrast, alt text, no color-only meaning, descriptive CTAs + plaintext URL); the `/track/[token]` link is the canonical absolute, `noindex` URL.
- [ ] **AC-15.** The order-status notification **sequence** (§4.9.1) is implemented: commit → post-commit send → `NotificationLog` → admin chip → optional founder WhatsApp.

---

## 11. Dependencies, assumptions & open questions

### 11.1 Dependencies

- **CANON `00`** — `NotificationChannel`/`NotificationStatus` enums, `NotificationLog`/`EmailTemplate` entities, `WHATSAPP_NUMBER`/`RESEND_API_KEY`/`SMTP_*`/`MSG91_*`/`EMAIL_FROM` env, order lifecycle (§7), routes/cache rules.
- **`02` System Architecture** — the email pipeline (FR-23–25), WhatsApp/SMS posture (FR-26/27), cron (`/api/cron/pending-orders`), env (`EMAIL_PROVIDER`, `EMAIL_FROM`, `CRON_SECRET`).
- **`03` Data Model** — `NotificationLog`/`EmailTemplate` fields; `Order`/`OrderItem`/`OrderStatusEvent` shapes (esp. snapshot FR-11) and the GST/DPDP behaviors.
- **`08` Cart/Checkout** — the `placeOrder` post-commit trigger, template keys (`order_received_*`), variables (§9.1), and the WhatsApp handoff body (§4.5) — this doc **owns the send**, `08` owns the call site.
- **`10` Admin Foundation** — `admin_password_reset` trigger (FR-18) + in-app notification bell/badges/alert strip (the non-email half of admin alerting).
- **`12` Order Management** *(not yet written)* — the status-transition action that **calls** this doc’s sends, captures courier/tracking on `shipped`, owns the Notify toggle/Resend UI, and `setPaymentStatus`.
- **`13` Analytics** — ingestion of `whatsapp_click`/`outbound_click`.
- **`15` CMS** — contact/newsletter forms that trigger `contact_*`/`newsletter_welcome`; `SiteSetting` editing.
- **External:** Resend account + verified domain; DNS control over `googlywoogly.art` (SPF/DKIM/DMARC); Gmail app-password for fallback; `[V1]` MSG91/Fast2SMS account **with completed DLT registration + approved templates**.

### 11.2 Assumptions (decisive calls)

- **MVP = email (automated) + WhatsApp (deep-link, human-initiated)**; SMS deferred to V1 behind DLT (CANON §15.6). ✅
- **From `orders@googlywoogly.art`, Reply-To `contactEmail`** — a no-reply-style send mailbox with replies routed to the founder’s real inbox (FR-9/FR-12).
- **React Email components are the structural source of truth; `EmailTemplate` rows override subject/copy** (FR-29) — founder can tweak words without a deploy, engineers keep layout type-safe.
- **WhatsApp deep links are not persisted as `NotificationLog` sends** (they’re URLs a human opens), but **are** captured as `whatsapp_click` analytics (FR-3/Open Q-1).
- **No customer email on `ready_to_ship`** (internal status) and **`on_hold` is opt-in** (FR-17/FR-18).
- **`review_request` is V1** (depends on Reviews, also V1 — CANON §3).

### 11.3 Open questions (genuine decisions / CANON gaps)

1. **WhatsApp click logging surface.** WhatsApp deep-link "sends" are human-initiated URL opens, so I log them as **`whatsapp_click` `AnalyticsEvent`** (not `NotificationLog`). If the founder wants a unified per-order "messages sent" view that also lists WhatsApp nudges, we’d additionally write a `NotificationLog{channel:'whatsapp', status:'sent'}` at click time. **Decision taken:** analytics-only in MVP. *Confirm.*
2. **Sending domain isolation.** Using the **root** `orders@googlywoogly.art` for MVP simplicity; isolating to a `send.` subdomain only if reputation/volume later warrants. *Confirm acceptable for launch.*
3. **Gmail-SMTP fallback From alignment.** If Gmail fallback isn’t on Google Workspace for `googlywoogly.art`, fallback emails may send from a Gmail address (DKIM/SPF aligned to that mailbox) with a clear From name — acceptable as a **rare-outage** fallback only. *Confirm, or require Workspace so the fallback also sends from-domain.*
4. **`EmailTemplate` vs code-only templates.** CANON lists `EmailTemplate{key,subject,htmlBody,variables[]}`. I use **React Email components for layout** + **`EmailTemplate` rows for founder-editable subject/copy** (not the full `htmlBody`, to avoid HTML editing in admin). `htmlBody` is treated as an optional advanced override. *Confirm this split, or require full HTML stored in `EmailTemplate.htmlBody`.*
5. **Retry/queue in MVP.** MVP is single-attempt + manual Resend; durable retry (Upstash/KV) + Resend bounce webhook are **V1** (`02` §16.3). *Confirm single-attempt is acceptable for launch.*
6. **`order_received_admin` template-key naming.** CANON §6 doesn’t enumerate template keys; `08` already fixed `order_received_customer`/`order_received_admin`. I extend with `order_{status}_customer`. *Fold this key set into CANON §6 (or a `14` appendix) as the closed list.*
7. **Open/click tracking.** Whether to enable Resend open/click tracking (adds a tracking pixel/redirect) given DPDP minimal-data posture. **Decision taken:** **off** in MVP (privacy-first); revisit in V1 if deliverability insight is needed. *Confirm.*

---

## 12. Phasing — MVP vs V1 vs later

| Capability | MVP | V1 | V2 / later |
|---|---|---|---|
| Provider-agnostic mailer (Resend primary + Gmail SMTP fallback) | ✅ | | |
| SPF/DKIM/DMARC on `googlywoogly.art`, from/reply-to, plaintext parts | ✅ | | |
| React Email templates + `EmailTemplate` override layer | ✅ | | |
| Customer order emails: received, confirmed, in_production, shipped (courier+tracking), delivered, cancelled, on_hold | ✅ | | |
| Admin alerts: instant `order_received_admin` + daily `pending_orders_digest_admin` cron | ✅ | | |
| Lead/account emails: bulk ack+admin, contact ack+admin, newsletter welcome, admin password reset | ✅ | | |
| WhatsApp deep-link generator (ask-product, order handoff, founder→customer per-status) + `whatsapp_click` | ✅ | | |
| `NotificationLog` for every send; admin per-order notification history + Resend; idempotent sends | ✅ | | |
| SMS channel reserved as `skipped` no-op | ✅ | | |
| **SMS via MSG91/Fast2SMS** (placed/confirmed/shipped/delivered) **after TRAI DLT registration + approved templates** | | ✅ | |
| `review_request_customer` (post-delivery, N-day cron) | | ✅ | |
| Resend **bounce/complaint webhook** + suppression list + open/click metrics (optional) | | ✅ | |
| Durable **retry queue** (Upstash/Vercel KV) + automatic SMTP failover | | ✅ | |
| **WhatsApp Business API** (Gupshup/Meta) — automated/templated WhatsApp, two-way ingest, payment links | | | ✅ |
| Localized/multi-language email (beyond `en-IN`) | | | ✅ |

---

*End of `14-notifications-email-sms-whatsapp.md`.*
