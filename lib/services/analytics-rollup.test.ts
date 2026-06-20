// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

// `analytics-rollup` imports `server-only` (it also does DB work) which throws
// outside an RSC bundle; neutralise it so we can exercise the PURE exports.
// Mirrors `lib/services/admin-dashboard.test.ts`. We never call the DB paths
// (`rollupDay`/`rollupRange`) here, so `@/lib/db`/Prisma is never touched.
vi.mock("server-only", () => ({}));

import {
  IST_OFFSET_MS,
  conversionRateBps,
  istDayBounds,
  referrerHost,
  topNFromCounts,
  type TopAccumulator,
} from "./analytics-rollup";

/**
 * Unit tests for the PURE rollup helpers (docs/13 FR-18). The DB aggregation in
 * `rollupDay`/`rollupRange` is intentionally untested here — there is no test DB
 * (per task) — so we extract and verify the load-bearing pure logic: basis-point
 * conversion, the top-N reducer (incl. tiebreak + determinism), referrer-host
 * extraction, and the IST calendar-day boundary math.
 */

describe("conversionRateBps", () => {
  it("returns integer basis points = round(orders/sessions * 10000)", () => {
    // 5 / 100 = 0.05 → 5.00% → 500 bps.
    expect(conversionRateBps(5, 100)).toBe(500);
    // 1 / 3 = 0.3333… → 3333.33 bps → rounds to 3333.
    expect(conversionRateBps(1, 3)).toBe(3333);
    // 2 / 3 = 0.6666… → 6666.66 bps → rounds to 6667.
    expect(conversionRateBps(2, 3)).toBe(6667);
  });

  it("treats zero/negative sessions as 0 bps (NULLIF, no divide-by-zero)", () => {
    expect(conversionRateBps(0, 0)).toBe(0);
    expect(conversionRateBps(10, 0)).toBe(0);
    expect(conversionRateBps(10, -5)).toBe(0);
  });

  it("never produces a float (always an integer)", () => {
    for (const [o, s] of [
      [7, 13],
      [1, 7],
      [123, 456],
      [999, 1000],
    ] as const) {
      const bps = conversionRateBps(o, s);
      expect(Number.isInteger(bps)).toBe(true);
    }
  });

  it("caps at 10000 bps for a 100% rate", () => {
    expect(conversionRateBps(50, 50)).toBe(10_000);
  });
});

/** Tiny accumulator factory for top-N tests. */
function acc(
  key: string,
  count: number,
  tiebreak = 0,
  valuePaise = 0,
  label = key,
): TopAccumulator {
  return { key, label, count, tiebreak, valuePaise };
}

function toMap(rows: TopAccumulator[]): Map<string, TopAccumulator> {
  return new Map(rows.map((r) => [r.key, r]));
}

describe("topNFromCounts", () => {
  it("ranks by count descending and truncates to N", () => {
    const map = toMap([acc("a", 3), acc("b", 10), acc("c", 7), acc("d", 1)]);
    const top = topNFromCounts(map, 2);
    expect(top.map((e) => e.key)).toEqual(["b", "c"]);
    expect(top.map((e) => e.count)).toEqual([10, 7]);
  });

  it("breaks count ties by the tiebreak field (e.g. add-to-cart) descending", () => {
    // Equal product_view counts; the one with more add-to-carts wins.
    const map = toMap([
      acc("low-atc", 5, /*tiebreak*/ 1),
      acc("high-atc", 5, /*tiebreak*/ 9),
    ]);
    const top = topNFromCounts(map, 10);
    expect(top.map((e) => e.key)).toEqual(["high-atc", "low-atc"]);
  });

  it("is deterministic: equal count+tiebreak fall back to key ascending", () => {
    const map = toMap([acc("zeta", 4, 2), acc("alpha", 4, 2), acc("mid", 4, 2)]);
    const top = topNFromCounts(map, 10);
    expect(top.map((e) => e.key)).toEqual(["alpha", "mid", "zeta"]);
  });

  it("omits valuePaise when zero and includes it when positive", () => {
    const map = toMap([acc("paid", 2, 0, 199_00), acc("free", 1, 0, 0)]);
    const top = topNFromCounts(map, 10);
    const paid = top.find((e) => e.key === "paid");
    const free = top.find((e) => e.key === "free");
    expect(paid).toMatchObject({ key: "paid", valuePaise: 199_00 });
    expect(free && "valuePaise" in free).toBe(false);
  });

  it("carries the human label through", () => {
    const map = toMap([acc("prod_1", 3, 0, 0, "Hand-painted Diya")]);
    const [entry] = topNFromCounts(map, 10);
    expect(entry.label).toBe("Hand-painted Diya");
    expect(entry.key).toBe("prod_1");
  });

  it("returns an empty array for an empty map", () => {
    expect(topNFromCounts(new Map(), 20)).toEqual([]);
  });

  it("defaults N to 20 (the persisted top-N size)", () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      acc(`k${String(i).padStart(2, "0")}`, 30 - i),
    );
    const top = topNFromCounts(toMap(rows));
    expect(top).toHaveLength(20);
    expect(top[0].key).toBe("k00"); // highest count
  });
});

describe("referrerHost", () => {
  it("extracts the lowercased host from a full URL", () => {
    expect(referrerHost("https://www.Google.com/search?q=x")).toBe("www.google.com");
    expect(referrerHost("http://Instagram.com/p/abc")).toBe("instagram.com");
  });

  it("handles a bare host or origin+path without a scheme", () => {
    expect(referrerHost("facebook.com/somepage")).toBe("facebook.com");
    expect(referrerHost("t.co")).toBe("t.co");
  });

  it("returns null for empty / whitespace / nullish input", () => {
    expect(referrerHost(null)).toBeNull();
    expect(referrerHost(undefined)).toBeNull();
    expect(referrerHost("")).toBeNull();
    expect(referrerHost("   ")).toBeNull();
  });

  it("returns null for an unparseable referrer", () => {
    // A lone "://" has no host.
    expect(referrerHost("://")).toBeNull();
  });
});

describe("istDayBounds", () => {
  it("maps an instant to UTC-midnight PK + the [start,end) IST-day window", () => {
    // 2025-03-15 09:00 IST == 2025-03-15 03:30 UTC.
    const instant = new Date("2025-03-15T03:30:00.000Z");
    const b = istDayBounds(instant);

    expect(b.iso).toBe("2025-03-15");
    // PK is UTC-midnight of the IST calendar date (the @db.Date representation).
    expect(b.date.toISOString()).toBe("2025-03-15T00:00:00.000Z");
    // IST-midnight 2025-03-15 == 2025-03-14T18:30:00Z.
    expect(b.startUtc.toISOString()).toBe("2025-03-14T18:30:00.000Z");
    // Exactly 24h later.
    expect(b.endUtc.getTime() - b.startUtc.getTime()).toBe(86_400_000);
    expect(b.endUtc.toISOString()).toBe("2025-03-15T18:30:00.000Z");
  });

  it("puts a late-evening-UTC instant on the NEXT IST day", () => {
    // 2025-03-14 19:00 UTC == 2025-03-15 00:30 IST → belongs to 2025-03-15.
    const instant = new Date("2025-03-14T19:00:00.000Z");
    const b = istDayBounds(instant);
    expect(b.iso).toBe("2025-03-15");
    expect(b.date.toISOString()).toBe("2025-03-15T00:00:00.000Z");
  });

  it("keeps an instant just before IST-midnight on the PREVIOUS IST day", () => {
    // 2025-03-14 18:29:59Z == 2025-03-14 23:59:59 IST → still 2025-03-14.
    const instant = new Date("2025-03-14T18:29:59.000Z");
    const b = istDayBounds(instant);
    expect(b.iso).toBe("2025-03-14");
    expect(b.startUtc.toISOString()).toBe("2025-03-13T18:30:00.000Z");
  });

  it("the start bound is inclusive and the end bound is exclusive of the window", () => {
    const b = istDayBounds(new Date("2025-06-13T12:00:00.000Z"));
    // An instant exactly at startUtc lands in this day…
    expect(istDayBounds(b.startUtc).iso).toBe(b.iso);
    // …while one at endUtc rolls into the next day (half-open [start, end)).
    expect(istDayBounds(b.endUtc).iso).not.toBe(b.iso);
  });

  it("rolls month/year boundaries correctly (IST)", () => {
    // 2024-12-31 20:00 UTC == 2025-01-01 01:30 IST → New Year's Day IST.
    const b = istDayBounds(new Date("2024-12-31T20:00:00.000Z"));
    expect(b.iso).toBe("2025-01-01");
    expect(b.date.toISOString()).toBe("2025-01-01T00:00:00.000Z");
  });

  it("uses the fixed +05:30 offset", () => {
    expect(IST_OFFSET_MS).toBe((5 * 60 + 30) * 60_000);
  });
});
