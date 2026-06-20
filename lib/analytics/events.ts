/**
 * Pure analytics helpers — User-Agent classification, bot detection, and UTM
 * parsing. No DB, no `server-only`: this module is imported by the ingest
 * service (server) and is fully unit-testable.
 *
 * Device classification and bot detection are regex-based on purpose: the MVP
 * ships no UA-parsing dependency (cost/bundle, CANON §16.8 "any new dependency
 * must have a free tier or be rejected"), and the spec only needs the
 * `DeviceType` buckets (`mobile|tablet|desktop|bot`, docs/13 FR-13) plus a
 * crawler/headless drop list (docs/13 FR-8).
 */

import { DeviceType } from "@prisma/client";

/** UTM fields parsed from an allow-listed querystring (docs/03 §3.5, docs/13 FR-13). */
export interface Utm {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

/**
 * Bot / crawler / headless User-Agent patterns (docs/13 FR-8). Includes the
 * named crawlers the spec calls out plus the generic `bot|crawler|spider|slurp`
 * family and common non-browser HTTP clients. Case-insensitive.
 */
const BOT_UA_PATTERNS: readonly RegExp[] = [
  // Generic crawler family.
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /\bslurp\b/i,
  /crawl(?:ing|er)?/i,
  // Named crawlers (also caught by the generic rules; explicit for clarity).
  /googlebot/i,
  /bingbot/i,
  /ahrefsbot/i,
  /semrushbot/i,
  /yandex(?:bot)?/i,
  /baiduspider/i,
  /duckduckbot/i,
  /facebookexternalhit/i,
  /facebot/i,
  /ia_archiver/i,
  /applebot/i,
  /petalbot/i,
  /bytespider/i,
  /gptbot/i,
  /claudebot/i,
  /\bccbot\b/i,
  // Headless / automation runtimes & performance tooling.
  /headlesschrome/i,
  /phantomjs/i,
  /puppeteer/i,
  /playwright/i,
  /selenium/i,
  /lighthouse/i,
  /chrome-lighthouse/i,
  /prerender/i,
  // Programmatic HTTP clients.
  /python-requests/i,
  /python-urllib/i,
  /\bcurl\//i,
  /\bwget\b/i,
  /node-fetch/i,
  /axios\//i,
  /go-http-client/i,
  /java\//i,
  /okhttp/i,
  /libwww-perl/i,
  /apache-httpclient/i,
  /httpie/i,
  /postmanruntime/i,
  /\bscrapy\b/i,
  // Monitoring / link-preview agents.
  /uptimerobot/i,
  /pingdom/i,
  /\bphantom\b/i,
  /headless/i,
  /whatsapp/i,
  /telegrambot/i,
  /slackbot/i,
  /discordbot/i,
  /embedly/i,
  /\bpetal\b/i,
];

/**
 * True when the User-Agent looks like a bot/crawler/headless agent and its
 * traffic must be dropped before persistence (docs/13 FR-8, server gate).
 *
 * A missing/empty UA is treated as a bot: legitimate browsers always send one;
 * an absent UA is overwhelmingly automation, and dropping it keeps the funnel
 * credible (the #1 self-hosted-analytics failure mode).
 */
export function isBot(ua?: string | null): boolean {
  if (!ua) return true;
  const s = ua.trim();
  if (s.length === 0) return true;
  return BOT_UA_PATTERNS.some((re) => re.test(s));
}

/** Tablet signatures checked before the generic mobile check (iPad/Android tablet/Kindle). */
const TABLET_UA_PATTERNS: readonly RegExp[] = [
  /ipad/i,
  /\btablet\b/i,
  /playbook/i,
  /\bkindle\b/i,
  /silk/i,
  /\bnexus (?:7|9|10)\b/i,
  // Android *without* "Mobile" is conventionally a tablet.
  /android(?!.*\bmobile\b)/i,
  // iPadOS 13+ masquerades as desktop Safari but exposes Macintosh + touch;
  // we cannot read touch here, so this is best-effort via the explicit ipad rule above.
];

/** Phone signatures. */
const MOBILE_UA_PATTERNS: readonly RegExp[] = [
  /\bmobi\b/i,
  /\bmobile\b/i,
  /iphone/i,
  /ipod/i,
  /\bandroid\b/i,
  /blackberry/i,
  /\bbb10\b/i,
  /iemobile/i,
  /windows phone/i,
  /opera mini/i,
  /opera mobi/i,
  /webos/i,
  /palm/i,
];

/**
 * Classify a User-Agent into a CANON `DeviceType` (docs/03 §3.3, docs/13 FR-13).
 * Order matters: bot → tablet → mobile → desktop. An unknown/empty UA already
 * fails `isBot`, so it resolves to `bot`.
 */
export function deviceFromUserAgent(ua?: string | null): DeviceType {
  if (isBot(ua)) return DeviceType.bot;
  const s = (ua ?? "").trim();
  if (TABLET_UA_PATTERNS.some((re) => re.test(s))) return DeviceType.tablet;
  if (MOBILE_UA_PATTERNS.some((re) => re.test(s))) return DeviceType.mobile;
  return DeviceType.desktop;
}

/** Accepts the shapes a request commonly exposes for query params. */
export type UtmParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined | null>
  | string
  | null
  | undefined;

const UTM_KEYS = {
  utm_source: "source",
  utm_medium: "medium",
  utm_campaign: "campaign",
  utm_term: "term",
  utm_content: "content",
} as const satisfies Record<string, keyof Utm>;

/** Cap stored UTM values so a hostile/huge querystring can't bloat the row. */
const MAX_UTM_VALUE_LENGTH = 200;

function readParam(
  source: URLSearchParams | Record<string, string | string[] | undefined | null>,
  key: string,
): string | undefined {
  let raw: string | string[] | undefined | null;
  if (source instanceof URLSearchParams) {
    raw = source.get(key) ?? undefined;
  } else {
    raw = source[key];
  }
  if (Array.isArray(raw)) raw = raw[0];
  if (raw == null) return undefined;
  const v = String(raw).trim();
  if (v.length === 0) return undefined;
  return v.slice(0, MAX_UTM_VALUE_LENGTH);
}

/**
 * Parse the five UTM fields from a querystring / param map (docs/03 §3.5).
 * Only `utm_source/medium/campaign/term/content` are read; everything else is
 * ignored (allow-list, never the full querystring — docs/13 FR-9). Returns an
 * empty object when no UTM params are present.
 */
export function parseUtm(params: UtmParamsInput): Utm {
  if (params == null) return {};

  let source: URLSearchParams | Record<string, string | string[] | undefined | null>;
  if (typeof params === "string") {
    // Accept a full URL, a "?a=b" search string, or a bare "a=b" query.
    let qs = params;
    const q = qs.indexOf("?");
    if (q >= 0) qs = qs.slice(q + 1);
    const hash = qs.indexOf("#");
    if (hash >= 0) qs = qs.slice(0, hash);
    source = new URLSearchParams(qs);
  } else {
    source = params;
  }

  const utm: Utm = {};
  for (const [param, field] of Object.entries(UTM_KEYS) as [
    keyof typeof UTM_KEYS,
    (typeof UTM_KEYS)[keyof typeof UTM_KEYS],
  ][]) {
    const value = readParam(source, param);
    if (value !== undefined) utm[field] = value;
  }
  return utm;
}

/** True when a parsed UTM object carries at least one field. */
export function hasUtm(utm: Utm): boolean {
  return Boolean(
    utm.source || utm.medium || utm.campaign || utm.term || utm.content,
  );
}

// ───────────────────────────── funnel computation (pure) ─────────────────────────────

/**
 * The five rollup columns the funnel reads (docs/13 FR-19; subset of
 * `DailyMetricRollup`). Structurally compatible with the Prisma rollup row so
 * `computeFunnel(getDailyRollups(...))` type-checks without a cast.
 */
export interface FunnelRollupInput {
  pageviews: number;
  productViews: number;
  addToCarts: number;
  beginCheckouts: number;
  orders: number;
}

/** A single funnel step with its absolute count and conversion ratios. */
export interface FunnelStep {
  /** Step key, matching the CANON funnel event names (docs/00 §12). */
  step:
    | "page_view"
    | "product_view"
    | "add_to_cart"
    | "begin_checkout"
    | "place_order";
  /** Absolute event count over the range. */
  count: number;
  /** Fraction of the previous step (0..1); `1` for the first step. */
  rateFromPrev: number;
  /** Fraction of the top step / `page_view` (0..1); `0` when there are no page views. */
  rateFromTop: number;
  /** Visitors lost vs the previous step (count). `0` for the first step. */
  dropOff: number;
}

/** Aggregate funnel result returned by {@link computeFunnel}. */
export interface Funnel {
  pageViews: number;
  productViews: number;
  addToCarts: number;
  beginCheckouts: number;
  orders: number;
  /** Per-step breakdown in funnel order (page_view → place_order). */
  steps: FunnelStep[];
  /** Step-to-step conversion fractions (0..1). */
  rates: {
    /** product_view / page_view */
    viewToProduct: number;
    /** add_to_cart / product_view */
    productToCart: number;
    /** begin_checkout / add_to_cart */
    cartToCheckout: number;
    /** place_order / begin_checkout */
    checkoutToOrder: number;
    /** orders / page_view — overall funnel conversion */
    overall: number;
  };
}

/** Safe ratio in [0,1]: 0 when the denominator is 0 (no divide-by-zero, docs/13 §7). */
function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

/**
 * Compute the 5-step conversion funnel (docs/13 FR-19, FR-26) by summing the
 * funnel columns across the supplied daily rollups. Pure and total: an empty
 * input yields all-zero counts and zero rates. Event-volume based (not strict
 * per-session sequential) per the MVP note in docs/13 FR-26.
 */
export function computeFunnel(rollups: readonly FunnelRollupInput[]): Funnel {
  let pageViews = 0;
  let productViews = 0;
  let addToCarts = 0;
  let beginCheckouts = 0;
  let orders = 0;

  for (const r of rollups) {
    pageViews += r.pageviews ?? 0;
    productViews += r.productViews ?? 0;
    addToCarts += r.addToCarts ?? 0;
    beginCheckouts += r.beginCheckouts ?? 0;
    orders += r.orders ?? 0;
  }

  const rates = {
    viewToProduct: ratio(productViews, pageViews),
    productToCart: ratio(addToCarts, productViews),
    cartToCheckout: ratio(beginCheckouts, addToCarts),
    checkoutToOrder: ratio(orders, beginCheckouts),
    overall: ratio(orders, pageViews),
  };

  const steps: FunnelStep[] = [
    {
      step: "page_view",
      count: pageViews,
      rateFromPrev: 1,
      rateFromTop: pageViews > 0 ? 1 : 0,
      dropOff: 0,
    },
    {
      step: "product_view",
      count: productViews,
      rateFromPrev: rates.viewToProduct,
      rateFromTop: ratio(productViews, pageViews),
      dropOff: Math.max(0, pageViews - productViews),
    },
    {
      step: "add_to_cart",
      count: addToCarts,
      rateFromPrev: rates.productToCart,
      rateFromTop: ratio(addToCarts, pageViews),
      dropOff: Math.max(0, productViews - addToCarts),
    },
    {
      step: "begin_checkout",
      count: beginCheckouts,
      rateFromPrev: rates.cartToCheckout,
      rateFromTop: ratio(beginCheckouts, pageViews),
      dropOff: Math.max(0, addToCarts - beginCheckouts),
    },
    {
      step: "place_order",
      count: orders,
      rateFromPrev: rates.checkoutToOrder,
      rateFromTop: ratio(orders, pageViews),
      dropOff: Math.max(0, beginCheckouts - orders),
    },
  ];

  return {
    pageViews,
    productViews,
    addToCarts,
    beginCheckouts,
    orders,
    steps,
    rates,
  };
}
