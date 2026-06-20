import { describe, it, expect } from "vitest";
import { AnalyticsEventType, DeviceType } from "@prisma/client";
import {
  trackEventSchema,
  trackEventBatchSchema,
  metadataSchema,
  MAX_EVENTS_PER_BATCH,
  MAX_METADATA_KEYS,
} from "./analytics";

// `overrides` is deliberately a loose record (not Partial<TrackEventInput>) so
// the strict-rejection tests can supply unknown / PII keys without a cast; the
// runtime schema is what enforces the contract.
function validEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    visitorId: "vid_abc123",
    sessionId: "sid_xyz789",
    type: AnalyticsEventType.page_view,
    path: "/products/hand-painted-mug",
    ...overrides,
  };
}

describe("trackEventSchema — valid input", () => {
  it("accepts a minimal valid event (visitorId + type + path)", () => {
    const r = trackEventSchema.safeParse({
      visitorId: "vid_1",
      type: AnalyticsEventType.page_view,
      path: "/",
    });
    expect(r.success).toBe(true);
  });

  it("accepts a fully-populated event", () => {
    const r = trackEventSchema.safeParse(
      validEvent({
        type: AnalyticsEventType.add_to_cart,
        referrer: "https://instagram.com/p/abc",
        productId: "prod_1",
        value: 129900,
        metadata: { slug: "hand-painted-mug", qty: 2, source: "pdp" },
        device: DeviceType.mobile,
        country: "IN",
        utm: { source: "instagram", campaign: "diwali" },
      }),
    );
    expect(r.success).toBe(true);
  });

  it("coerces country to uppercase", () => {
    const r = trackEventSchema.parse(validEvent({ country: "in" }));
    expect(r.country).toBe("IN");
  });

  it("accepts every CANON AnalyticsEventType member", () => {
    for (const t of Object.values(AnalyticsEventType)) {
      const r = trackEventSchema.safeParse(validEvent({ type: t }));
      expect(r.success, `type ${t} should be valid`).toBe(true);
    }
  });
});

describe("trackEventSchema — required fields", () => {
  it("requires visitorId (missing)", () => {
    const { visitorId, ...rest } = validEvent();
    void visitorId;
    const r = trackEventSchema.safeParse(rest);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.visitorId).toBeTruthy();
    }
  });

  it("rejects an empty visitorId", () => {
    expect(trackEventSchema.safeParse(validEvent({ visitorId: "" })).success).toBe(false);
    expect(trackEventSchema.safeParse(validEvent({ visitorId: "   " })).success).toBe(false);
  });

  it("requires path (missing)", () => {
    const { path, ...rest } = validEvent();
    void path;
    const r = trackEventSchema.safeParse(rest);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.path).toBeTruthy();
    }
  });

  it("rejects an empty path", () => {
    expect(trackEventSchema.safeParse(validEvent({ path: "" })).success).toBe(false);
  });

  it("requires a valid type from the enum", () => {
    expect(
      trackEventSchema.safeParse({ visitorId: "v", path: "/", type: "scroll" }).success,
    ).toBe(false);
  });

  it("makes sessionId optional", () => {
    const { sessionId, ...rest } = validEvent();
    void sessionId;
    expect(trackEventSchema.safeParse(rest).success).toBe(true);
  });
});

describe("trackEventSchema — value (paise)", () => {
  it("rejects negative or non-integer value", () => {
    expect(trackEventSchema.safeParse(validEvent({ value: -1 })).success).toBe(false);
    expect(trackEventSchema.safeParse(validEvent({ value: 10.5 })).success).toBe(false);
  });
  it("accepts zero and positive integer paise", () => {
    expect(trackEventSchema.safeParse(validEvent({ value: 0 })).success).toBe(true);
    expect(trackEventSchema.safeParse(validEvent({ value: 250000 })).success).toBe(true);
  });
});

describe("trackEventSchema — NO PII permitted (strict)", () => {
  // The privacy invariant: unknown keys (which is where PII would arrive) are rejected.
  const piiKeys = [
    "name",
    "email",
    "phone",
    "customerName",
    "customerEmail",
    "customerPhone",
    "address",
    "fullName",
    "pincode",
    "ip",
  ];

  for (const key of piiKeys) {
    it(`rejects a smuggled PII field: ${key}`, () => {
      const r = trackEventSchema.safeParse(validEvent({ [key]: "leak" }));
      expect(r.success, `${key} must be rejected`).toBe(false);
    });
  }

  it("rejects PII hidden inside metadata via a nested object", () => {
    // metadata values must be primitives — a nested object (where PII could hide) is invalid.
    const r = trackEventSchema.safeParse(
      validEvent({ metadata: { customer: { email: "a@b.com" } } }),
    );
    expect(r.success).toBe(false);
  });

  it("rejects any unknown top-level key", () => {
    expect(trackEventSchema.safeParse(validEvent({ foo: "bar" })).success).toBe(false);
  });
});

describe("metadataSchema", () => {
  it("accepts a flat record of primitives", () => {
    expect(
      metadataSchema.safeParse({ slug: "mug", qty: 2, inStock: true }).success,
    ).toBe(true);
  });

  it("rejects nested objects and arrays", () => {
    expect(metadataSchema.safeParse({ a: { b: 1 } }).success).toBe(false);
    expect(metadataSchema.safeParse({ a: [1, 2] }).success).toBe(false);
  });

  it(`rejects more than ${MAX_METADATA_KEYS} keys`, () => {
    const tooMany: Record<string, number> = {};
    for (let i = 0; i < MAX_METADATA_KEYS + 1; i++) tooMany[`k${i}`] = i;
    expect(metadataSchema.safeParse(tooMany).success).toBe(false);
  });

  it("accepts exactly the key limit", () => {
    const atLimit: Record<string, number> = {};
    for (let i = 0; i < MAX_METADATA_KEYS; i++) atLimit[`k${i}`] = i;
    expect(metadataSchema.safeParse(atLimit).success).toBe(true);
  });
});

describe("trackEventBatchSchema", () => {
  it("accepts a batch of valid events", () => {
    const r = trackEventBatchSchema.safeParse({
      events: [validEvent(), validEvent({ type: AnalyticsEventType.product_view })],
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty events array", () => {
    expect(trackEventBatchSchema.safeParse({ events: [] }).success).toBe(false);
  });

  it(`caps the batch at ${MAX_EVENTS_PER_BATCH} events`, () => {
    const ok = { events: Array.from({ length: MAX_EVENTS_PER_BATCH }, () => validEvent()) };
    const over = { events: Array.from({ length: MAX_EVENTS_PER_BATCH + 1 }, () => validEvent()) };
    expect(trackEventBatchSchema.safeParse(ok).success).toBe(true);
    expect(trackEventBatchSchema.safeParse(over).success).toBe(false);
  });

  it("rejects a batch containing an invalid event", () => {
    const r = trackEventBatchSchema.safeParse({
      events: [validEvent(), { visitorId: "v", type: "nope", path: "/" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown top-level keys on the batch", () => {
    expect(
      trackEventBatchSchema.safeParse({ events: [validEvent()], extra: 1 }).success,
    ).toBe(false);
  });
});
