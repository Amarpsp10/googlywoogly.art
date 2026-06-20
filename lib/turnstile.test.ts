// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// `turnstile.ts` is `server-only`; neutralise the guard in tests (repo pattern,
// see lib/admin/sanitize-html.test.ts).
vi.mock("server-only", () => ({}));

import { verifyTurnstile } from "./turnstile";

/**
 * The primary contract under test is the **unconfigured pass-through** (dev works
 * with no secret). We also cover the configured branches with a mocked `fetch` so
 * no real network call is made.
 */
describe("verifyTurnstile", () => {
  const ORIGINAL = process.env.TURNSTILE_SECRET_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = ORIGINAL;
  });

  it("returns true (no-op) when TURNSTILE_SECRET_KEY is unset — and never calls fetch", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(await verifyTurnstile("any-token")).toBe(true);
    // Even a missing token passes when unconfigured (graceful dev no-op).
    expect(await verifyTurnstile(undefined)).toBe(true);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns false without calling fetch when configured but token is missing", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(await verifyTurnstile(undefined)).toBe(false);
    expect(await verifyTurnstile("")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns true when siteverify reports success", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    expect(await verifyTurnstile("good-token", "203.0.113.5")).toBe(true);
  });

  it("returns false when siteverify reports failure", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), {
        status: 200,
      }),
    );
    expect(await verifyTurnstile("bad-token")).toBe(false);
  });

  it("fails closed (false) on a network error when configured", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    expect(await verifyTurnstile("good-token")).toBe(false);
  });

  it("fails closed (false) on a non-200 siteverify response", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    expect(await verifyTurnstile("good-token")).toBe(false);
  });
});
