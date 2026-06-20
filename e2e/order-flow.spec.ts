import { test, expect, type Page } from "@playwright/test";

/**
 * Critical buyer journey (CANON `08`): home → catalog → PDP → add to cart →
 * cart drawer → checkout → place order → token-gated confirmation → tracking.
 *
 * There is NO on-site payment: `placeOrder` captures intent and hands off to
 * WhatsApp, so the journey "ends" on the confirmation page (WhatsApp CTA) and
 * the `/track/:token` timeline — both reached via the opaque tracking token in
 * the redirect URL, never via an order id.
 *
 * Data assumptions (seeded): at least one ACTIVE, orderable product is visible
 * on `/products`. The selectors below are role/label-based and mirror the built
 * UI (checkout-form.tsx, cart-drawer.tsx, order/confirmed + track pages).
 */

// A valid Indian buyer per `lib/validations/common.ts` (phone `^[6-9]\d{9}$`,
// pincode `^[1-9]\d{5}$`, state must be a real `INDIAN_STATES` entry).
const BUYER = {
  name: "Test Buyer",
  phone: "9876543210",
  email: "test.buyer@example.com",
  recipient: "Test Recipient",
  deliveryPhone: "9876543211",
  line1: "12 Pink City Lane, Bapu Bazaar",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302001",
} as const;

/**
 * The soft-consent banner is bottom-anchored and `pointer-events-none` except
 * on its card, but it can still overlap the checkout CTA. Dismiss it up front so
 * it never intercepts a click. No-op if it isn't shown.
 */
async function dismissConsent(page: Page): Promise<void> {
  const banner = page.getByRole("dialog", { name: /cookie and analytics/i });
  if (await banner.isVisible().catch(() => false)) {
    await banner.getByRole("button", { name: /accept/i }).click();
    await expect(banner).toBeHidden();
  }
}

test("guest places an order and can track it", async ({ page }) => {
  // ── 1. Home ────────────────────────────────────────────────────────────
  await page.goto("/");
  await dismissConsent(page);
  await expect(page).toHaveTitle(/.+/);

  // ── 2. Catalog ─────────────────────────────────────────────────────────
  // The marketing landing's hero CTA "Shop Collection" links to /products;
  // assert it's present, then navigate directly. (Clicking it is flaky in
  // headless Chromium: after Playwright auto-scrolls, animated hero layers
  // yield the hit-test. Real users click it fine — a headless artefact.)
  await expect(page.getByRole("link", { name: /shop collection/i }).first()).toBeVisible();
  await page.goto("/products");
  await expect(page).toHaveURL(/\/products(\?.*)?$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /handmade gifts/i }),
  ).toBeVisible();

  // ── 3. PDP ─────────────────────────────────────────────────────────────
  // Open the first product by clicking its card image/title link. Product
  // cards link to `/products/<slug>`; take the first such link in the grid.
  const firstProductLink = page
    .locator('a[href^="/products/"]')
    .filter({ has: page.locator("img") })
    .first();
  await expect(firstProductLink).toBeVisible();
  await firstProductLink.click();
  await expect(page).toHaveURL(/\/products\/[^/?#]+/);

  // The PDP buy panel renders an "Add to cart" CTA (size lg). The product card
  // grid below ("You may also like") also has Add-to-cart buttons, so target
  // the one in the main column heading area by taking the first.
  const pdpHeading = page.getByRole("heading", { level: 1 });
  await expect(pdpHeading).toBeVisible();

  // The Add-to-cart button keeps the accessible name "Add to cart" (its
  // aria-label is constant; only the visible label/icon flips to "Added!").
  // Click the first one (the PDP buy panel sits above the related-products grid).
  const addToCart = page.getByRole("button", { name: "Add to cart" }).first();
  await expect(addToCart).toBeEnabled();
  await addToCart.click();

  // ── 4. Cart drawer → checkout ──────────────────────────────────────────
  // Proof the item landed: the header cart button's accessible name gains the
  // item count once the cart store updates ("Open cart, 1 item").
  const cartButton = page.getByRole("button", { name: /open cart, \d+ item/i });
  await expect(cartButton).toBeVisible();
  await cartButton.click();
  const cartDrawer = page.getByRole("dialog", { name: /shopping cart/i });
  await expect(cartDrawer).toBeVisible();
  await cartDrawer.getByRole("link", { name: /^checkout$/i }).click();

  // ── 5. Checkout ────────────────────────────────────────────────────────
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /checkout/i }),
  ).toBeVisible();
  await dismissConsent(page);

  // Wait for the client cart to hydrate (the form replaces the "Loading…"
  // placeholder with the real fields once `useCart` is ready).
  //
  // Required field labels render a trailing " *", so match labels with anchored
  // case-insensitive regexes (substring) rather than exact strings.
  await expect(page.getByLabel(/^Full name/)).toBeVisible();

  // Contact block. Scope to the "Contact details" fieldset — "Email" otherwise
  // also matches the footer newsletter's "Email address" field (strict-mode clash).
  const contact = page.getByRole("group", { name: /contact details/i });
  await contact.getByLabel(/^Full name/).fill(BUYER.name);
  await contact.getByLabel(/^Phone \(WhatsApp\)/).fill(BUYER.phone);
  await contact.getByLabel(/^Email/).fill(BUYER.email);

  // Shipping address block.
  await page.getByLabel(/^Recipient name/).fill(BUYER.recipient);
  await page.getByLabel(/^Delivery phone/).fill(BUYER.deliveryPhone);
  await page.getByLabel(/^Address line 1/).fill(BUYER.line1);
  await page.getByLabel(/^City/).fill(BUYER.city);
  await page.getByLabel(/^Pincode/).fill(BUYER.pincode);

  // State is a Radix Select (combobox trigger → portal option list).
  await page.getByLabel(/^State/).click();
  await page.getByRole("option", { name: BUYER.state }).click();

  // ── 6. Place order ─────────────────────────────────────────────────────
  // CTA label is "Place order · ₹…"; match on the stable prefix.
  await page.getByRole("button", { name: /place order/i }).click();

  // ── 7. Confirmation (token-gated) ──────────────────────────────────────
  await page.waitForURL(/\/order\/confirmed\/[^/?#]+/, { timeout: 30_000 });
  const token = new URL(page.url()).pathname.split("/").pop()!;
  expect(token, "tracking token in confirmation URL").toBeTruthy();

  await expect(
    page.getByRole("heading", { level: 1, name: /thank you! your order is in/i }),
  ).toBeVisible();

  // The single most important CTA — payment happens on WhatsApp. It links to a
  // wa.me / api.whatsapp.com URL and opens in a new tab.
  const whatsappCta = page.getByRole("link", { name: /continue on whatsapp/i });
  await expect(whatsappCta).toBeVisible();
  await expect(whatsappCta).toHaveAttribute(
    "href",
    /(wa\.me|api\.whatsapp\.com)/,
  );
  await expect(whatsappCta).toHaveAttribute("target", "_blank");

  // The human-readable order number is shown next to "Order number".
  await expect(page.getByText(/order number/i)).toBeVisible();

  // ── 8. Tracking timeline ───────────────────────────────────────────────
  await page.getByRole("link", { name: /track your order/i }).first().click();
  await expect(page).toHaveURL(new RegExp(`/track/${token}$`));

  // The tracking page H1 is the order number; the "Progress" section holds the
  // status timeline (an ordered list of status events). A freshly placed order
  // is "pending_confirmation", which emits at least one timeline event.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /^progress$/i }),
  ).toBeVisible();
  // Order-tracking eyebrow + a status badge confirm the status surface rendered.
  await expect(page.getByText(/order tracking/i)).toBeVisible();
});
