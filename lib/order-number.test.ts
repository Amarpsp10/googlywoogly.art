import { describe, it, expect } from "vitest";
import {
  formatOrderNumber,
  parseOrderNumber,
  generateTrackingToken,
  ORDER_NUMBER_PREFIX,
  ORDER_SEQ_MIN_WIDTH,
  TRACKING_TOKEN_LENGTH,
} from "./order-number";

describe("formatOrderNumber", () => {
  it("zero-pads the sequence to 5 digits (CANON §10 example)", () => {
    expect(formatOrderNumber(2026, 42)).toBe("GW-2026-00042");
    expect(formatOrderNumber(2026, 1)).toBe("GW-2026-00001");
  });

  it("renders a full-width sequence and one over the pad width", () => {
    expect(formatOrderNumber(2026, 12345)).toBe("GW-2026-12345");
    expect(formatOrderNumber(2026, 100000)).toBe("GW-2026-100000");
  });

  it("uses the brand prefix and pad-width constants", () => {
    expect(formatOrderNumber(2026, 7).startsWith(`${ORDER_NUMBER_PREFIX}-`)).toBe(true);
    const seqPart = formatOrderNumber(2026, 7).split("-")[2];
    expect(seqPart.length).toBe(ORDER_SEQ_MIN_WIDTH);
  });
});

describe("parseOrderNumber", () => {
  it("round-trips a formatted order number", () => {
    const n = formatOrderNumber(2026, 42);
    expect(parseOrderNumber(n)).toEqual({ year: 2026, seq: 42 });
  });

  it("parses a wide sequence", () => {
    expect(parseOrderNumber("GW-2027-100000")).toEqual({ year: 2027, seq: 100000 });
  });

  it("trims surrounding whitespace", () => {
    expect(parseOrderNumber("  GW-2026-00042  ")).toEqual({ year: 2026, seq: 42 });
  });

  it("returns null for malformed input", () => {
    expect(parseOrderNumber("")).toBeNull();
    expect(parseOrderNumber("GW-2026-1234")).toBeNull(); // < 5 seq digits
    expect(parseOrderNumber("XX-2026-00042")).toBeNull(); // wrong prefix
    expect(parseOrderNumber("GW-26-00042")).toBeNull(); // 2-digit year
    expect(parseOrderNumber("GW-2026-00042-1")).toBeNull(); // trailing garbage
    expect(parseOrderNumber("GW202600042")).toBeNull(); // no separators
  });
});

describe("generateTrackingToken", () => {
  it("is at least the canonical length and URL-safe (default size)", () => {
    const t = generateTrackingToken();
    expect(t.length).toBe(TRACKING_TOKEN_LENGTH);
    expect(TRACKING_TOKEN_LENGTH).toBeGreaterThanOrEqual(24);
    // nanoid default alphabet: A-Za-z0-9_-  (no chars needing URL-encoding)
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(t)).toBe(t);
  });

  it("honors a custom size", () => {
    expect(generateTrackingToken(32).length).toBe(32);
  });

  it("produces unique tokens across many calls (no collisions)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateTrackingToken());
    expect(seen.size).toBe(1000);
  });
});
