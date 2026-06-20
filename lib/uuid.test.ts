import { describe, it, expect, afterEach, vi } from "vitest";
import { z } from "zod";
import { safeRandomUUID } from "./uuid";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("safeRandomUUID", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns a valid v4 UUID (native crypto.randomUUID path)", () => {
    const id = safeRandomUUID();
    expect(id).toMatch(UUID_V4);
    expect(z.string().uuid().safeParse(id).success).toBe(true);
  });

  it("returns unique values across calls", () => {
    expect(safeRandomUUID()).not.toBe(safeRandomUUID());
  });

  it("falls back to getRandomValues when randomUUID is missing (non-secure context)", () => {
    const real = globalThis.crypto;
    // Simulate a plain-HTTP LAN-IP origin: getRandomValues exists, randomUUID doesn't.
    vi.stubGlobal("crypto", { getRandomValues: real.getRandomValues.bind(real) });
    const id = safeRandomUUID();
    expect(id).toMatch(UUID_V4);
    expect(z.string().uuid().safeParse(id).success).toBe(true);
  });
});
