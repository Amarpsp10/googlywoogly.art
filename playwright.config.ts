import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for the GooglyWoogly storefront (Next.js 16).
 *
 * ONE-TIME SETUP: the Chromium browser binary must be installed once before the
 * first run:
 *
 *     npx playwright install chromium
 *
 * These specs drive the *built* app, so they assume a production build exists
 * (`pnpm build`) and a seeded database (`pnpm db:seed`) with at least one active
 * product and the ADMIN_BOOTSTRAP_* credentials. The `webServer` below boots the
 * app with `pnpm start`; set `reuseExistingServer` so a dev server you already
 * have running on :3000 is reused instead of spawning a second one.
 *
 * Run:    pnpm exec playwright test
 * Report: pnpm exec playwright show-report
 */

// Allow overriding the target origin (e.g. a preview deploy) without editing
// this file; default to the local `pnpm start` server.
const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

// In CI we never reuse an external server and we forbid `.only`; locally we
// reuse a running dev/start server for a fast inner loop.
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",

  // A built Next app + a server action round-trip (DB write) is heavier than a
  // unit test; give each test and each assertion generous-but-bounded budgets.
  timeout: 60_000,
  expect: { timeout: 15_000 },

  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Order placement writes real rows; keep writes serial-ish to avoid seeded
  // stock races between parallel workers.
  workers: isCI ? 1 : undefined,

  reporter: isCI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  // Shared defaults for every test. `baseURL` lets specs use relative paths
  // (`page.goto("/")`). Artefacts are captured only on failure to keep runs lean.
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    testIdAttribute: "data-testid",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Boot the production server for the test run. Reuse an already-running server
  // on the same port locally (fast iteration); always start fresh in CI.
  webServer: {
    command: "pnpm start",
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
