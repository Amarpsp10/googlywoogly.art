// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { rateLimit, clientIp, __resetRateLimit } from "./rate-limit";

describe("rateLimit (sliding window)", () => {
  beforeEach(() => {
    __resetRateLimit();
  });

  it("allows up to `limit` hits, then blocks", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    expect(rateLimit("k", opts)).toMatchObject({ ok: true, remaining: 2 });
    expect(rateLimit("k", opts)).toMatchObject({ ok: true, remaining: 1 });
    expect(rateLimit("k", opts)).toMatchObject({ ok: true, remaining: 0 });

    const blocked = rateLimit("k", opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("isolates distinct keys", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(rateLimit("a", opts).ok).toBe(true);
    expect(rateLimit("a", opts).ok).toBe(false); // a is now full
    expect(rateLimit("b", opts).ok).toBe(true); // b is independent
  });

  it("frees the window after `windowMs` elapses (sliding reset)", () => {
    vi.useFakeTimers();
    try {
      const opts = { limit: 2, windowMs: 1_000 };
      const t0 = new Date("2026-01-01T00:00:00.000Z").getTime();
      vi.setSystemTime(t0);

      expect(rateLimit("k", opts).ok).toBe(true);
      expect(rateLimit("k", opts).ok).toBe(true);
      expect(rateLimit("k", opts).ok).toBe(false); // full

      // Advance just past the window — the two old hits age out.
      vi.setSystemTime(t0 + 1_001);
      const after = rateLimit("k", opts);
      expect(after.ok).toBe(true);
      expect(after.remaining).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("slides partially: only hits older than the window are dropped", () => {
    vi.useFakeTimers();
    try {
      const opts = { limit: 2, windowMs: 1_000 };
      const t0 = new Date("2026-01-01T00:00:00.000Z").getTime();
      vi.setSystemTime(t0);

      expect(rateLimit("k", opts).ok).toBe(true); // hit @ t0
      vi.setSystemTime(t0 + 600);
      expect(rateLimit("k", opts).ok).toBe(true); // hit @ t0+600 → full

      // At t0+1001 the first hit (t0) has aged out but the second (t0+600) lives,
      // so exactly one slot is free.
      vi.setSystemTime(t0 + 1_001);
      expect(rateLimit("k", opts).ok).toBe(true); // takes the freed slot
      expect(rateLimit("k", opts).ok).toBe(false); // full again
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a retryAfterMs that shrinks as the window drains", () => {
    vi.useFakeTimers();
    try {
      const opts = { limit: 1, windowMs: 1_000 };
      const t0 = new Date("2026-01-01T00:00:00.000Z").getTime();
      vi.setSystemTime(t0);
      expect(rateLimit("k", opts).ok).toBe(true);

      vi.setSystemTime(t0 + 250);
      const a = rateLimit("k", opts);
      expect(a.ok).toBe(false);
      expect(a.retryAfterMs).toBe(750); // 1000 - 250

      vi.setSystemTime(t0 + 900);
      const b = rateLimit("k", opts);
      expect(b.ok).toBe(false);
      expect(b.retryAfterMs).toBe(100); // 1000 - 900
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("clientIp", () => {
  function hdrs(map: Record<string, string>): Headers {
    return new Headers(map);
  }

  it("takes the first address from x-forwarded-for", () => {
    expect(clientIp(hdrs({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" }))).toBe(
      "203.0.113.7",
    );
  });

  it("trims whitespace around the forwarded client", () => {
    expect(clientIp(hdrs({ "x-forwarded-for": "  198.51.100.2 , 10.0.0.1" }))).toBe("198.51.100.2");
  });

  it("falls back to x-real-ip when no forwarded-for", () => {
    expect(clientIp(hdrs({ "x-real-ip": "192.0.2.44" }))).toBe("192.0.2.44");
  });

  it("returns 'unknown' when nothing identifies the client", () => {
    expect(clientIp(hdrs({}))).toBe("unknown");
  });

  it("accepts a minimal { get } adapter", () => {
    const adapter = { get: (n: string) => (n === "x-forwarded-for" ? "8.8.8.8" : null) };
    expect(clientIp(adapter)).toBe("8.8.8.8");
  });
});
