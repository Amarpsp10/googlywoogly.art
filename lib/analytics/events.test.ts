import { describe, it, expect } from "vitest";
import { DeviceType } from "@prisma/client";
import {
  deviceFromUserAgent,
  isBot,
  parseUtm,
  hasUtm,
  computeFunnel,
  type FunnelRollupInput,
} from "./events";

// Representative real-world User-Agent strings.
const UA = {
  chromeDesktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  androidPhone:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  ipad:
    "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  androidTablet:
    "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  googlebot:
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  bingbot:
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  ahrefs: "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
  semrush:
    "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)",
  headless:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/124.0.0.0 Safari/537.36",
  curl: "curl/8.4.0",
  pythonRequests: "python-requests/2.31.0",
  nodeFetch: "node-fetch/1.0",
  facebook: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
} as const;

describe("isBot", () => {
  it("flags named crawlers", () => {
    expect(isBot(UA.googlebot)).toBe(true);
    expect(isBot(UA.bingbot)).toBe(true);
    expect(isBot(UA.ahrefs)).toBe(true);
    expect(isBot(UA.semrush)).toBe(true);
    expect(isBot(UA.facebook)).toBe(true);
  });

  it("flags headless browsers and HTTP clients", () => {
    expect(isBot(UA.headless)).toBe(true);
    expect(isBot(UA.curl)).toBe(true);
    expect(isBot(UA.pythonRequests)).toBe(true);
    expect(isBot(UA.nodeFetch)).toBe(true);
  });

  it("flags the generic bot/crawler/spider/slurp family", () => {
    expect(isBot("SomeRandomBot/1.0")).toBe(true);
    expect(isBot("MJ12crawler")).toBe(true);
    expect(isBot("Mozilla/5.0 (compatible; Yahoo! Slurp)")).toBe(true);
    expect(isBot("evil-spider/3")).toBe(true);
  });

  it("treats missing or empty UA as a bot", () => {
    expect(isBot(undefined)).toBe(true);
    expect(isBot(null)).toBe(true);
    expect(isBot("")).toBe(true);
    expect(isBot("   ")).toBe(true);
  });

  it("does NOT flag genuine browsers", () => {
    expect(isBot(UA.chromeDesktop)).toBe(false);
    expect(isBot(UA.macSafari)).toBe(false);
    expect(isBot(UA.iphone)).toBe(false);
    expect(isBot(UA.androidPhone)).toBe(false);
    expect(isBot(UA.ipad)).toBe(false);
  });
});

describe("deviceFromUserAgent", () => {
  it("classifies desktop browsers", () => {
    expect(deviceFromUserAgent(UA.chromeDesktop)).toBe(DeviceType.desktop);
    expect(deviceFromUserAgent(UA.macSafari)).toBe(DeviceType.desktop);
  });

  it("classifies phones as mobile", () => {
    expect(deviceFromUserAgent(UA.iphone)).toBe(DeviceType.mobile);
    expect(deviceFromUserAgent(UA.androidPhone)).toBe(DeviceType.mobile);
  });

  it("classifies tablets", () => {
    expect(deviceFromUserAgent(UA.ipad)).toBe(DeviceType.tablet);
    // Android without "Mobile" is conventionally a tablet.
    expect(deviceFromUserAgent(UA.androidTablet)).toBe(DeviceType.tablet);
  });

  it("classifies bots/headless/unknown as bot", () => {
    expect(deviceFromUserAgent(UA.googlebot)).toBe(DeviceType.bot);
    expect(deviceFromUserAgent(UA.headless)).toBe(DeviceType.bot);
    expect(deviceFromUserAgent(UA.curl)).toBe(DeviceType.bot);
    expect(deviceFromUserAgent(undefined)).toBe(DeviceType.bot);
    expect(deviceFromUserAgent("")).toBe(DeviceType.bot);
  });

  it("prefers tablet over mobile when both could match (Android tablet has no 'Mobile')", () => {
    // Sanity: the androidPhone has "Mobile" → mobile; androidTablet lacks it → tablet.
    expect(deviceFromUserAgent(UA.androidPhone)).toBe(DeviceType.mobile);
    expect(deviceFromUserAgent(UA.androidTablet)).toBe(DeviceType.tablet);
  });
});

describe("parseUtm", () => {
  it("parses all five fields from a querystring", () => {
    const utm = parseUtm(
      "utm_source=instagram&utm_medium=social&utm_campaign=diwali&utm_term=diya&utm_content=story1",
    );
    expect(utm).toEqual({
      source: "instagram",
      medium: "social",
      campaign: "diwali",
      term: "diya",
      content: "story1",
    });
  });

  it("parses from a full URL with a path and hash", () => {
    const utm = parseUtm(
      "https://googlywoogly.art/products?utm_source=whatsapp&utm_campaign=blast#top",
    );
    expect(utm).toEqual({ source: "whatsapp", campaign: "blast" });
  });

  it("parses from a leading-? search string", () => {
    expect(parseUtm("?utm_source=newsletter")).toEqual({ source: "newsletter" });
  });

  it("parses from a URLSearchParams instance", () => {
    const sp = new URLSearchParams("utm_medium=email&foo=bar");
    expect(parseUtm(sp)).toEqual({ medium: "email" });
  });

  it("parses from a plain record and ignores non-UTM keys", () => {
    expect(
      parseUtm({ utm_source: "fb", q: "mug", page: "2", ref: "x" }),
    ).toEqual({ source: "fb" });
  });

  it("takes the first value when a param repeats / is an array", () => {
    expect(parseUtm("utm_source=a&utm_source=b")).toEqual({ source: "a" });
    expect(parseUtm({ utm_source: ["first", "second"] })).toEqual({
      source: "first",
    });
  });

  it("returns an empty object for no UTM, empty, null, or undefined input", () => {
    expect(parseUtm("")).toEqual({});
    expect(parseUtm("?q=mug")).toEqual({});
    expect(parseUtm(null)).toEqual({});
    expect(parseUtm(undefined)).toEqual({});
    expect(parseUtm({})).toEqual({});
  });

  it("ignores blank-valued UTM params", () => {
    expect(parseUtm("utm_source=&utm_medium=social")).toEqual({
      medium: "social",
    });
  });

  it("truncates oversized values to 200 chars", () => {
    const long = "x".repeat(500);
    const utm = parseUtm(`utm_campaign=${long}`);
    expect(utm.campaign).toHaveLength(200);
  });
});

describe("hasUtm", () => {
  it("is true when any field is present, false when empty", () => {
    expect(hasUtm({ source: "ig" })).toBe(true);
    expect(hasUtm({ content: "x" })).toBe(true);
    expect(hasUtm({})).toBe(false);
    expect(hasUtm({ source: "" })).toBe(false);
  });
});

describe("computeFunnel", () => {
  const rollups: FunnelRollupInput[] = [
    {
      pageviews: 6000,
      productViews: 1800,
      addToCarts: 360,
      beginCheckouts: 100,
      orders: 30,
    },
    {
      pageviews: 4000,
      productViews: 1400,
      addToCarts: 280,
      beginCheckouts: 80,
      orders: 24,
    },
  ];

  it("sums the funnel columns across rollups", () => {
    const f = computeFunnel(rollups);
    expect(f.pageViews).toBe(10000);
    expect(f.productViews).toBe(3200);
    expect(f.addToCarts).toBe(640);
    expect(f.beginCheckouts).toBe(180);
    expect(f.orders).toBe(54);
  });

  it("computes step-to-step and overall rates", () => {
    const f = computeFunnel(rollups);
    expect(f.rates.viewToProduct).toBeCloseTo(0.32, 10); // 3200/10000
    expect(f.rates.productToCart).toBeCloseTo(0.2, 10); // 640/3200
    expect(f.rates.cartToCheckout).toBeCloseTo(0.28125, 10); // 180/640
    expect(f.rates.checkoutToOrder).toBeCloseTo(0.3, 10); // 54/180
    expect(f.rates.overall).toBeCloseTo(0.0054, 10); // 54/10000
  });

  it("emits five steps in funnel order with counts, prev-rates and drop-offs", () => {
    const f = computeFunnel(rollups);
    expect(f.steps.map((s) => s.step)).toEqual([
      "page_view",
      "product_view",
      "add_to_cart",
      "begin_checkout",
      "place_order",
    ]);
    expect(f.steps[0]).toMatchObject({ count: 10000, rateFromPrev: 1, rateFromTop: 1, dropOff: 0 });
    expect(f.steps[1]).toMatchObject({ count: 3200, dropOff: 6800 }); // 10000-3200
    expect(f.steps[1].rateFromPrev).toBeCloseTo(0.32, 10);
    expect(f.steps[4]).toMatchObject({ count: 54, dropOff: 126 }); // 180-54
  });

  it("is total/safe on empty input (all zeros, no divide-by-zero)", () => {
    const f = computeFunnel([]);
    expect(f.pageViews).toBe(0);
    expect(f.orders).toBe(0);
    expect(f.rates.viewToProduct).toBe(0);
    expect(f.rates.overall).toBe(0);
    expect(f.steps[0]).toMatchObject({ count: 0, rateFromTop: 0, dropOff: 0 });
    expect(f.steps.every((s) => s.count === 0 && s.dropOff === 0)).toBe(true);
  });

  it("returns zero rates when an intermediate step is zero (no NaN)", () => {
    const f = computeFunnel([
      { pageviews: 100, productViews: 0, addToCarts: 0, beginCheckouts: 0, orders: 0 },
    ]);
    expect(f.rates.viewToProduct).toBe(0);
    expect(f.rates.productToCart).toBe(0); // 0/0 → 0, not NaN
    expect(Number.isNaN(f.rates.checkoutToOrder)).toBe(false);
    expect(f.steps[1].dropOff).toBe(100);
  });
});
