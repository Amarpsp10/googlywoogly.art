import { describe, it, expect } from "vitest";
import { z } from "zod";
import { siteSettingsInputSchema } from "@/lib/validations/content";
import {
  zodErrorToFieldErrors,
  siteSettingsFieldErrors,
  SITE_SETTINGS_FIELD_RENAME,
} from "./form-field-errors";

/** Parse `input` with `schema`, asserting it fails, and return the ZodError. */
function errorOf<T extends z.ZodTypeAny>(schema: T, input: unknown): z.ZodError {
  const r = schema.safeParse(input);
  if (r.success) throw new Error("expected the parse to fail");
  return r.error;
}

describe("zodErrorToFieldErrors", () => {
  const nested = z.object({
    top: z.string().min(1, "top required"),
    group: z.object({ leaf: z.string().min(1, "leaf required") }),
  });

  it("keys a top-level issue by its field name", () => {
    const errors = zodErrorToFieldErrors(errorOf(nested, { top: "", group: { leaf: "ok" } }));
    expect(errors).toEqual({ top: ["top required"] });
  });

  it("keys a NESTED issue by its leaf name (not the parent object)", () => {
    const errors = zodErrorToFieldErrors(errorOf(nested, { top: "ok", group: { leaf: "" } }));
    // The whole point: the error is reachable as `leaf`, never buried under `group`.
    expect(errors).toEqual({ leaf: ["leaf required"] });
    expect(errors).not.toHaveProperty("group");
  });

  it("applies the rename map for inputs whose name differs from the schema path", () => {
    const errors = zodErrorToFieldErrors(errorOf(nested, { top: "ok", group: { leaf: "" } }), {
      "group.leaf": "renamedInput",
    });
    expect(errors).toEqual({ renamedInput: ["leaf required"] });
  });

  it("merges multiple issues that map to the same field", () => {
    const schema = z.object({ v: z.string().min(3, "too short").regex(/^x/, "must start with x") });
    const errors = zodErrorToFieldErrors(errorOf(schema, { v: "a" }));
    expect(errors.v).toEqual(["too short", "must start with x"]);
  });

  it("skips form-level (pathless) issues so they fall through to the banner", () => {
    const schema = z.object({ a: z.string() }).refine(() => false, "whole form is wrong");
    const errors = zodErrorToFieldErrors(errorOf(schema, { a: "x" }));
    expect(errors).toEqual({});
  });
});

describe("siteSettingsFieldErrors", () => {
  // A minimal candidate the settings editor assembles that parses cleanly.
  const base = {
    storeName: "GooglyWoogly Art",
    contactEmail: "hello@example.com",
    whatsappNumber: "9876543210",
    socialLinks: { instagram: "https://instagram.com/googlywoogly" },
    shippingDefaults: { flatRatePaise: 12000, freeShippingThresholdPaise: 250000, codEnabled: false },
    currency: "INR" as const,
    defaultSeo: { titleTemplate: "%s · GooglyWoogly", defaultDescription: "Handmade gifts." },
    announcementBar: { enabled: true, text: "Free shipping over ₹2,500" },
    businessAddress: { legalName: "GooglyWoogly Art", country: "IN" as const },
  };

  it("the base candidate is valid (guards the fixtures below)", () => {
    expect(siteSettingsInputSchema.safeParse(base).success).toBe(true);
  });

  it("REGRESSION: an over-long Twitter handle highlights `twitterHandle`, not `defaultSeo`", () => {
    // This is the exact production data that made every save fail with a generic,
    // un-actionable "correct the highlighted fields" and nothing highlighted.
    const error = errorOf(siteSettingsInputSchema, {
      ...base,
      defaultSeo: { ...base.defaultSeo, twitterHandle: "@googlywoogly_arrtt" },
    });

    // The old code passed `flatten().fieldErrors`, which buries it under `defaultSeo`:
    expect(error.flatten().fieldErrors).toHaveProperty("defaultSeo");

    // The fix surfaces it on the actual input the form renders:
    const errors = siteSettingsFieldErrors(error);
    expect(errors).toHaveProperty("twitterHandle");
    expect(errors).not.toHaveProperty("defaultSeo");
    expect(errors.twitterHandle[0]).toMatch(/twitter/i);
  });

  it.each([
    ["shippingDefaults.flatRatePaise", { shippingDefaults: { ...base.shippingDefaults, flatRatePaise: -1 } }, "flatRate"],
    ["shippingDefaults.freeShippingThresholdPaise", { shippingDefaults: { ...base.shippingDefaults, freeShippingThresholdPaise: -1 } }, "freeShippingThreshold"],
    ["announcementBar.text", { announcementBar: { enabled: true, text: "x".repeat(201) } }, "announcementText"],
    ["socialLinks.whatsapp", { socialLinks: { ...base.socialLinks, whatsapp: "not a url" } }, "social_whatsapp"],
    ["businessAddress.line1", { businessAddress: { ...base.businessAddress, line1: "x".repeat(161) } }, "addressLine1"],
  ])("maps a %s error onto the renamed input", (_label, override, expectedField) => {
    const error = errorOf(siteSettingsInputSchema, { ...base, ...override });
    expect(siteSettingsFieldErrors(error)).toHaveProperty(expectedField);
  });

  it("every rename target is a real leaf→input remap (dotted key ends in the schema leaf)", () => {
    for (const dotted of Object.keys(SITE_SETTINGS_FIELD_RENAME)) {
      expect(dotted).toContain(".");
    }
  });
});
