import { describe, it, expect } from "vitest";
import {
  homepageSectionPayloadSchema,
  bannerInputSchema,
  testimonialInputSchema,
  faqItemInputSchema,
  cmsPageInputSchema,
  siteSettingsInputSchema,
} from "./content";

describe("homepageSectionPayloadSchema", () => {
  it("accepts a valid hero payload and keeps the discriminant", () => {
    const r = homepageSectionPayloadSchema.safeParse({
      type: "hero",
      headline: "Unique Handmade Gifts",
      ctaHref: "/products",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.type).toBe("hero");
  });

  it("rejects a hero payload missing the headline", () => {
    const r = homepageSectionPayloadSchema.safeParse({ type: "hero" });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown section type (closed renderer set)", () => {
    const r = homepageSectionPayloadSchema.safeParse({
      type: "carousel_3d",
      headline: "x",
    });
    expect(r.success).toBe(false);
  });

  it("defaults limit on a featured_products payload", () => {
    const r = homepageSectionPayloadSchema.safeParse({ type: "featured_products" });
    expect(r.success).toBe(true);
    if (r.success && r.data.type === "featured_products") {
      expect(r.data.limit).toBe(8);
    }
  });

  it("matches the seeded bestsellers payload shape", () => {
    const r = homepageSectionPayloadSchema.safeParse({
      type: "bestsellers",
      title: "Loved by our customers",
      collectionSlug: "bestsellers",
      limit: 8,
    });
    expect(r.success).toBe(true);
  });

  it("requires body text on a story payload", () => {
    expect(
      homepageSectionPayloadSchema.safeParse({ type: "story", title: "Meet the maker" })
        .success,
    ).toBe(false);
    expect(
      homepageSectionPayloadSchema.safeParse({
        type: "story",
        body: "Every piece is crafted by hand in Jaipur.",
      }).success,
    ).toBe(true);
  });

  it("rejects an instagram tile with a non-https href", () => {
    const r = homepageSectionPayloadSchema.safeParse({
      type: "instagram",
      tiles: [{ mediaId: "m1", href: "/local" }],
    });
    expect(r.success).toBe(false);
  });
});

describe("bannerInputSchema", () => {
  it("requires text for a marquee banner", () => {
    expect(bannerInputSchema.safeParse({ type: "marquee" }).success).toBe(false);
    expect(
      bannerInputSchema.safeParse({ type: "marquee", text: "Free shipping over ₹1,500" })
        .success,
    ).toBe(true);
  });

  it("allows an image-led hero banner without text", () => {
    const r = bannerInputSchema.safeParse({ type: "hero", imageId: "media-1" });
    expect(r.success).toBe(true);
  });

  it("rejects a schedule where startsAt is after endsAt", () => {
    const r = bannerInputSchema.safeParse({
      type: "promo",
      text: "Sale",
      startsAt: "2026-10-20T00:00:00.000Z",
      endsAt: "2026-10-10T00:00:00.000Z",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a valid forward schedule and coerces dates", () => {
    const r = bannerInputSchema.safeParse({
      type: "promo",
      text: "Diwali sale",
      startsAt: "2026-10-10T00:00:00.000Z",
      endsAt: "2026-10-20T00:00:00.000Z",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.startsAt).toBeInstanceOf(Date);
  });
});

describe("testimonialInputSchema", () => {
  it("accepts a valid testimonial and defaults isFeatured false", () => {
    const r = testimonialInputSchema.safeParse({
      customerName: "Aarav S.",
      location: "Mumbai",
      rating: 5,
      text: "Beautiful handmade plate.",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isFeatured).toBe(false);
  });

  it("rejects a rating outside 1-5", () => {
    expect(
      testimonialInputSchema.safeParse({ customerName: "X Y", text: "ok", rating: 6 })
        .success,
    ).toBe(false);
  });
});

describe("faqItemInputSchema", () => {
  it("requires question and answer", () => {
    expect(faqItemInputSchema.safeParse({ question: "How do I pay?" }).success).toBe(false);
    expect(
      faqItemInputSchema.safeParse({
        question: "How do I pay?",
        answer: "Confirm on WhatsApp.",
        category: "Orders",
      }).success,
    ).toBe(true);
  });
});

describe("cmsPageInputSchema", () => {
  it("validates slug, title and body", () => {
    const r = cmsPageInputSchema.safeParse({
      slug: "privacy-policy",
      title: "Privacy Policy",
      bodyRich: "<p>We respect your privacy.</p>",
      isPublished: true,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isPublished).toBe(true);
  });

  it("rejects a non-kebab slug", () => {
    expect(
      cmsPageInputSchema.safeParse({
        slug: "Privacy Policy",
        title: "T",
        bodyRich: "<p>x</p>",
      }).success,
    ).toBe(false);
  });

  it("rejects an over-long meta description", () => {
    const r = cmsPageInputSchema.safeParse({
      slug: "about",
      title: "About",
      bodyRich: "<p>x</p>",
      metaDescription: "a".repeat(200),
    });
    expect(r.success).toBe(false);
  });
});

describe("siteSettingsInputSchema", () => {
  const base = {
    storeName: "GooglyWoogly Art",
    contactEmail: "Hello@GooglyWoogly.art",
    whatsappNumber: "+91 63678 51899",
  };

  it("normalizes email and WhatsApp number", () => {
    const r = siteSettingsInputSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.contactEmail).toBe("hello@googlywoogly.art");
      expect(r.data.whatsappNumber).toBe("6367851899");
      expect(r.data.currency).toBe("INR");
    }
  });

  it("rejects an invalid WhatsApp number (core handoff)", () => {
    expect(
      siteSettingsInputSchema.safeParse({ ...base, whatsappNumber: "12345" }).success,
    ).toBe(false);
  });

  it("validates nested shippingDefaults as paise", () => {
    const r = siteSettingsInputSchema.safeParse({
      ...base,
      shippingDefaults: { flatRatePaise: 7900, freeShippingThresholdPaise: 150000 },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.shippingDefaults?.codEnabled).toBe(false);
  });

  it("rejects negative shipping money", () => {
    expect(
      siteSettingsInputSchema.safeParse({
        ...base,
        shippingDefaults: { flatRatePaise: -1, freeShippingThresholdPaise: 0 },
      }).success,
    ).toBe(false);
  });

  it("requires %s in the SEO title template", () => {
    expect(
      siteSettingsInputSchema.safeParse({
        ...base,
        defaultSeo: { titleTemplate: "GooglyWoogly Art", defaultDescription: "Handmade." },
      }).success,
    ).toBe(false);
    expect(
      siteSettingsInputSchema.safeParse({
        ...base,
        defaultSeo: {
          titleTemplate: "%s · GooglyWoogly Art",
          defaultDescription: "Handmade.",
        },
      }).success,
    ).toBe(true);
  });

  it("validates a GSTIN when provided", () => {
    expect(
      siteSettingsInputSchema.safeParse({ ...base, gstin: "08ABCDE1234F1Z5" }).success,
    ).toBe(true);
    expect(siteSettingsInputSchema.safeParse({ ...base, gstin: "INVALID" }).success).toBe(
      false,
    );
  });

  it("rejects a non-https social link", () => {
    expect(
      siteSettingsInputSchema.safeParse({
        ...base,
        socialLinks: { instagram: "instagram.com/googlywoogly" },
      }).success,
    ).toBe(false);
  });
});
