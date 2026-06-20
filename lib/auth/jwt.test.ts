// @vitest-environment node
// Auth crypto (jose) needs Node's TextEncoder/Uint8Array, not jsdom's — run this
// file in the node environment. We test the edge-safe `./jwt` module directly
// (no `server-only`/`next/headers` to stub).
import { describe, it, expect, beforeAll } from "vitest";
import { signToken, verifyToken } from "./jwt";

describe("session JWT", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "test-secret-key-at-least-16-characters-long";
  });

  it("round-trips a valid token to its { sub, role } payload", async () => {
    const token = await signToken({ id: "admin_123", role: "owner" });
    const payload = await verifyToken(token);
    expect(payload).toEqual({ sub: "admin_123", role: "owner" });
  });

  it("returns null for an empty/absent token", async () => {
    expect(await verifyToken(undefined)).toBeNull();
    expect(await verifyToken(null)).toBeNull();
    expect(await verifyToken("")).toBeNull();
  });

  it("returns null for a garbage token", async () => {
    expect(await verifyToken("not.a.jwt")).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signToken({ id: "a", role: "staff" });
    process.env.AUTH_SECRET = "a-completely-different-secret-value-1234";
    expect(await verifyToken(token)).toBeNull();
    // restore for any later tests
    process.env.AUTH_SECRET = "test-secret-key-at-least-16-characters-long";
  });

  it("carries each role faithfully", async () => {
    for (const role of ["owner", "admin", "staff"] as const) {
      const token = await signToken({ id: "x", role });
      const payload = await verifyToken(token);
      expect(payload?.role).toBe(role);
    }
  });
});
