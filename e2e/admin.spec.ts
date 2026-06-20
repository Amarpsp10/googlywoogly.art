import { test, expect } from "@playwright/test";

/**
 * Admin auth gate + dashboard smoke (CANON `10`).
 *
 * `/admin/*` is gated at the edge by `middleware.ts` (jose-verified session
 * cookie). An unauthenticated request is redirected to the PUBLIC `/admin-login`
 * page (with a sanitised `?next=`). After a valid bootstrap login the action
 * redirects back into `/admin`, where the dashboard greets the signed-in admin.
 *
 * Credentials come from the environment so the spec never hard-codes secrets;
 * they must match the seeded bootstrap admin (`prisma/seed.ts` reads the same
 * ADMIN_BOOTSTRAP_* vars). The test is skipped with a clear message if they are
 * absent, rather than failing spuriously.
 */

const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD;

test.describe("admin", () => {
  test("unauthenticated /admin redirects to the login page", async ({ page }) => {
    await page.goto("/admin");
    // Edge middleware bounces to /admin-login (optionally with ?next=…).
    await expect(page).toHaveURL(/\/admin-login(\?.*)?$/);
    await expect(
      page.getByRole("heading", { name: /googlywoogly admin/i }),
    ).toBeVisible();
    // The sign-in form is present.
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("bootstrap admin can sign in and load the dashboard", async ({ page }) => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD,
      "Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD to run the admin login E2E.",
    );

    // Start from the gated route so we exercise the real redirect → login → back.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin-login(\?.*)?$/);

    // The login form labels its inputs "Email" / "Password" (login-form.tsx).
    await page.getByLabel(/^Email/i).fill(ADMIN_EMAIL!);
    await page.getByLabel(/^Password/i).fill(ADMIN_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Successful login redirects to the sanitised `next` (defaults to /admin).
    await page.waitForURL(/\/admin(\/.*)?$/, { timeout: 30_000 });
    // We must NOT be back on the login page.
    await expect(page).not.toHaveURL(/\/admin-login/);

    // The dashboard greets the signed-in admin: "Welcome back, <name>".
    await expect(
      page.getByRole("heading", { level: 1, name: /welcome back/i }),
    ).toBeVisible();

    // A couple of stable dashboard surfaces confirm the page actually rendered
    // (quick actions + the KPI region), not just a shell.
    await expect(
      page.getByRole("link", { name: /view new orders/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: /key metrics/i }),
    ).toBeVisible();
  });
});
