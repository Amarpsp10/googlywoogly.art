import { describe, it, expect } from "vitest";
import { BannerType, HomepageSectionType } from "@prisma/client";
import {
  rupeeInputToPaise,
  paiseToRupeeInput,
  istLocalToDate,
  dateToISTLocalInput,
  bannerStatus,
  summarizeSectionPayload,
  RESERVED_CMS_SLUGS,
  cmsPageDef,
} from "./content-shared";

describe("rupeeInputToPaise", () => {
  it("converts whole rupees to paise", () => {
    expect(rupeeInputToPaise("999")).toBe(99900);
  });
  it("handles ₹ symbol, commas, and decimals", () => {
    expect(rupeeInputToPaise("₹1,299.50")).toBe(129950);
  });
  it("returns undefined for blank/null", () => {
    expect(rupeeInputToPaise("")).toBeUndefined();
    expect(rupeeInputToPaise(undefined)).toBeUndefined();
  });
  it("returns null for unparseable or negative", () => {
    expect(rupeeInputToPaise("abc")).toBeNull();
    expect(rupeeInputToPaise("-5")).toBeNull();
  });
  it("round-trips with paiseToRupeeInput", () => {
    expect(paiseToRupeeInput(rupeeInputToPaise("1500") ?? 0)).toBe("1500");
    expect(paiseToRupeeInput(null)).toBe("");
  });
});

describe("IST datetime round-trip", () => {
  it("parses an IST wall-clock string to the correct UTC instant", () => {
    // 2026-06-14 12:00 IST == 06:30 UTC.
    const d = istLocalToDate("2026-06-14T12:00");
    expect(d).toBeInstanceOf(Date);
    expect((d as Date).toISOString()).toBe("2026-06-14T06:30:00.000Z");
  });
  it("formats a UTC Date back to an IST datetime-local value", () => {
    const value = dateToISTLocalInput(new Date("2026-06-14T06:30:00.000Z"));
    expect(value).toBe("2026-06-14T12:00");
  });
  it("returns undefined for blank, null for invalid", () => {
    expect(istLocalToDate("")).toBeUndefined();
    expect(istLocalToDate("not-a-date")).toBeNull();
  });
  it("returns empty string for a null date", () => {
    expect(dateToISTLocalInput(null)).toBe("");
  });
});

describe("bannerStatus", () => {
  const now = new Date("2026-06-14T00:00:00Z");
  it("is 'off' when inactive", () => {
    expect(bannerStatus({ isActive: false, startsAt: null, endsAt: null }, now)).toBe("off");
  });
  it("is 'scheduled' before startsAt", () => {
    expect(
      bannerStatus({ isActive: true, startsAt: new Date("2026-06-20T00:00:00Z"), endsAt: null }, now),
    ).toBe("scheduled");
  });
  it("is 'expired' after endsAt", () => {
    expect(
      bannerStatus({ isActive: true, startsAt: null, endsAt: new Date("2026-06-10T00:00:00Z") }, now),
    ).toBe("expired");
  });
  it("is 'live' within the window (or open-ended)", () => {
    expect(bannerStatus({ isActive: true, startsAt: null, endsAt: null }, now)).toBe("live");
    expect(
      bannerStatus(
        { isActive: true, startsAt: new Date("2026-06-01T00:00:00Z"), endsAt: new Date("2026-06-30T00:00:00Z") },
        now,
      ),
    ).toBe("live");
  });
});

describe("summarizeSectionPayload", () => {
  it("uses headline for hero", () => {
    expect(summarizeSectionPayload(HomepageSectionType.hero, { headline: "Hello" })).toBe("Hello");
  });
  it("falls back to the type label when no title", () => {
    expect(summarizeSectionPayload(HomepageSectionType.category_grid, {})).toBe("Category grid");
  });
  it("is defensive against non-object payloads", () => {
    expect(summarizeSectionPayload(HomepageSectionType.hero, null)).toBe("Hero banner");
  });
});

describe("CMS page catalogue", () => {
  it("includes the fixed legal/content slugs", () => {
    expect(RESERVED_CMS_SLUGS.has("privacy-policy")).toBe(true);
    expect(RESERVED_CMS_SLUGS.has("about")).toBe(true);
    expect(RESERVED_CMS_SLUGS.has("not-a-page")).toBe(false);
  });
  it("flags legal pages", () => {
    expect(cmsPageDef("terms")?.legal).toBe(true);
    expect(cmsPageDef("about")?.legal).toBe(false);
  });
});

// Touch the enum import so it isn't flagged unused.
void BannerType;
