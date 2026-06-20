import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";

/**
 * Visual verification tour — screenshots every key surface (storefront + admin)
 * and exercises the two admin write paths the founder uses most: creating &
 * publishing a product, and advancing an order's status. Screenshots are written
 * to /tmp/gw-shots for manual/visual review (not committed).
 */

const SHOTS = "/tmp/gw-shots";
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

// A real 1×1 PNG (red pixel) used to exercise the live Cloudinary upload path.
const RED_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function dismissConsent(page: Page): Promise<void> {
  const banner = page.getByRole("dialog", { name: /cookie and analytics/i });
  if (await banner.isVisible().catch(() => false)) {
    await banner.getByRole("button", { name: /accept/i }).click();
    await expect(banner).toBeHidden().catch(() => {});
  }
}

test("storefront visual tour", async ({ page }) => {
  // 1. Landing page (categories, collections, bestsellers)
  await page.goto("/");
  await dismissConsent(page);
  await expect(page).toHaveTitle(/.+/);
  await shot(page, "01-landing");

  // 3/4. Product list page
  await page.goto("/products");
  await expect(page.getByRole("heading", { level: 1, name: /handmade gifts/i })).toBeVisible();
  await shot(page, "02-product-list");

  // Category page
  await page.goto("/category/wall-decor");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await shot(page, "03-category");

  // Product detail page
  await page
    .locator('a[href^="/products/"]')
    .filter({ has: page.locator("img") })
    .first()
    .click();
  await expect(page).toHaveURL(/\/products\/[^/?#]+/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await shot(page, "04-product-detail");

  // 5. Cart: add to cart + open drawer
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await page.getByRole("button", { name: /open cart, \d+ item/i }).click();
  await expect(page.getByRole("dialog", { name: /shopping cart/i })).toBeVisible();
  await shot(page, "05-cart-drawer");
});

test("admin visual tour", async ({ page }) => {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  test.skip(!email || !password, "Set ADMIN_BOOTSTRAP_* to run the admin tour.");

  // 1. Login
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin-login/);
  await page.getByLabel(/^Email/i).fill(email!);
  await page.getByLabel(/^Password/i).fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin(\/.*)?$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name: /welcome back/i })).toBeVisible();
  await shot(page, "06-admin-dashboard");

  // 3. Inventory management — products list
  await page.goto("/admin/products");
  await expect(page.getByRole("heading", { name: /products/i }).first()).toBeVisible();
  await shot(page, "07-admin-products");

  // 2. Use the product/inventory form to submit data
  await page.goto("/admin/products/new");
  await expect(page.getByPlaceholder("Hand-painted Ceramic Diya Set")).toBeVisible();
  await shot(page, "08-product-form-empty");

  const sku = `GW-E2E-${Date.now().toString().slice(-6)}`;
  const name = `E2E Test Mug ${sku}`;
  await page.getByPlaceholder("Hand-painted Ceramic Diya Set").fill(name);
  await page.getByPlaceholder("GW-DIYA-014").fill(sku);
  await page.getByPlaceholder("1499").fill("999");
  // Add an image. When Cloudinary is configured the form shows the upload
  // dropzone (a file input) — drive it with a real signed upload. Otherwise fall
  // back to add-by-URL so the tour stays green without Cloudinary creds.
  const fileInput = page.locator('input[type="file"]');
  if (await fileInput.count()) {
    await fileInput.setInputFiles({
      name: "e2e-mug.png",
      mimeType: "image/png",
      buffer: Buffer.from(RED_PNG_B64, "base64"),
    });
    // The signed upload lands a real Cloudinary thumbnail in the editor.
    await expect(page.locator('img[src*="res.cloudinary.com"]').first()).toBeVisible({
      timeout: 30_000,
    });
  } else {
    await page.getByLabel("Add image by URL").fill("https://picsum.photos/seed/e2e-mug/900/900");
    await page.keyboard.press("Enter");
  }
  // Category is a raw <select> (the one with a "No category" option).
  await page.locator("select").filter({ hasText: "No category" }).selectOption({ index: 1 });
  await shot(page, "09-product-form-filled");

  const publish = page.getByRole("button", { name: "Publish" });
  await expect(publish).toBeEnabled();
  await publish.click();
  // Success → redirect to the edit page.
  await page.waitForURL(/\/admin\/products\/[^/]+\/edit/, { timeout: 30_000 });
  await shot(page, "10-product-published");

  // Verify it shows in the catalog list.
  await page.goto("/admin/products");
  await expect(page.getByText(name).first()).toBeVisible();
  await shot(page, "11-product-in-list");

  // 3. Inventory view + website controls (settings)
  await page.goto("/admin/inventory");
  await shot(page, "12-inventory");
  await page.goto("/admin/settings");
  await shot(page, "13-settings");

  // 6. Manage an order on the admin side
  await page.goto("/admin/orders");
  await shot(page, "14-orders-list");
  await page.locator('a[href^="/admin/orders/"]').first().click();
  await page.waitForURL(/\/admin\/orders\/[^/]+$/);

  // Wait for the detail to finish STREAMING past its loading skeleton (the page
  // is force-dynamic SSR with a Suspense loading.tsx) — keyed on the order-number heading.
  await expect(page.getByRole("heading", { name: /GW-\d{4}-\d+/ })).toBeVisible({ timeout: 20_000 });
  await shot(page, "15-order-detail");

  // Advance the order pending_confirmation → confirmed IF it's still pending
  // (idempotent across re-runs: a re-run hits an already-advanced order).
  const advance = page.getByRole("button", { name: "Confirm order" }).first();
  if (await advance.isVisible().catch(() => false)) {
    await advance.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Confirm order" }).click();
    // Success state reveals a prefilled WhatsApp send link (notify defaults incl. WA).
    await expect(page.getByText(/open whatsapp/i)).toBeVisible({ timeout: 20_000 });
  }
  await shot(page, "16-order-confirmed");
});
