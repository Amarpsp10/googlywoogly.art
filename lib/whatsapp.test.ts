import { describe, it, expect } from "vitest";
import {
  buildWhatsAppLink,
  buildProductEnquiryMessage,
  buildOrderPlacedMessage,
  buildProductEnquiryLink,
  buildOrderPlacedLink,
} from "./whatsapp";

describe("buildWhatsAppLink", () => {
  it("strips non-digits from the number", () => {
    expect(buildWhatsAppLink("+91 63678 51899")).toBe("https://wa.me/916367851899");
    expect(buildWhatsAppLink("91-63678-51899")).toBe("https://wa.me/916367851899");
  });

  it("omits ?text when no message is given", () => {
    expect(buildWhatsAppLink("916367851899")).toBe("https://wa.me/916367851899");
  });

  it("omits ?text for an empty / whitespace-only message", () => {
    expect(buildWhatsAppLink("916367851899", "")).toBe("https://wa.me/916367851899");
    expect(buildWhatsAppLink("916367851899", "   ")).toBe("https://wa.me/916367851899");
  });

  it("URL-encodes the message into ?text", () => {
    const url = buildWhatsAppLink("916367851899", "Hi there! 👋 a&b=c");
    expect(url.startsWith("https://wa.me/916367851899?text=")).toBe(true);
    // spaces -> %20, & -> %26, = -> %3D, emoji percent-encoded
    expect(url).toContain("Hi%20there!%20");
    expect(url).toContain("a%26b%3Dc");
    expect(url).not.toContain(" ");
    // round-trips back to the original text
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toBe("Hi there! 👋 a&b=c");
  });

  it("returns an empty string when the number has no digits", () => {
    expect(buildWhatsAppLink("")).toBe("");
    expect(buildWhatsAppLink("abc-+", "hello")).toBe("");
  });
});

describe("buildProductEnquiryMessage", () => {
  it("includes the product title, absolute URL, and a question stub", () => {
    const msg = buildProductEnquiryMessage(
      { title: "Hand-painted Mug", slug: "hand-painted-mug" },
      "https://googlywoogly.art",
    );
    expect(msg).toContain('"Hand-painted Mug"');
    expect(msg).toContain("https://googlywoogly.art/products/hand-painted-mug");
    expect(msg).toContain("availability & customization");
  });

  it("does not double a trailing slash in the site URL", () => {
    const msg = buildProductEnquiryMessage(
      { title: "X", slug: "x" },
      "https://googlywoogly.art/",
    );
    expect(msg).toContain("https://googlywoogly.art/products/x");
    expect(msg).not.toContain("art//products");
  });
});

describe("buildOrderPlacedMessage", () => {
  const order = {
    orderNumber: "GW-2026-00042",
    customerName: "Aanya Sharma",
    grandTotal: 289700,
    items: [
      {
        productTitle: "Hand-painted Mug",
        quantity: 2,
        lineTotal: 159800,
        personalizationNote: "Engrave: Aanya",
      },
      {
        productTitle: "Brass Diya Set",
        quantity: 1,
        lineTotal: 129900,
        madeToOrderSnapshot: true,
      },
    ],
  };

  it("renders the order number, line items, total, and name", () => {
    const msg = buildOrderPlacedMessage(order);
    expect(msg).toContain("Order: GW-2026-00042");
    expect(msg).toContain("• Hand-painted Mug × 2 — ₹1,598  (Engrave: Aanya)");
    expect(msg).toContain("• Brass Diya Set × 1 — ₹1,299  (made to order)");
    expect(msg).toContain("Total: ₹2,897");
    expect(msg).toContain("Name: Aanya Sharma");
  });

  it("omits the parenthetical when there is no note and not made-to-order", () => {
    const msg = buildOrderPlacedMessage({
      orderNumber: "GW-2026-00001",
      customerName: "Test",
      grandTotal: 50000,
      items: [{ productTitle: "Candle", quantity: 1, lineTotal: 50000 }],
    });
    expect(msg).toContain("• Candle × 1 — ₹500");
    expect(msg).not.toContain("(");
  });

  it("prefers the personalization note over the made-to-order tag", () => {
    const msg = buildOrderPlacedMessage({
      orderNumber: "GW-2026-00002",
      customerName: "Test",
      grandTotal: 50000,
      items: [
        {
          productTitle: "Plate",
          quantity: 1,
          lineTotal: 50000,
          personalizationNote: "Name: Riya",
          madeToOrderSnapshot: true,
        },
      ],
    });
    expect(msg).toContain("(Name: Riya)");
    expect(msg).not.toContain("(made to order)");
  });
});

describe("link convenience builders", () => {
  it("buildProductEnquiryLink encodes the enquiry into a wa.me URL", () => {
    const url = buildProductEnquiryLink(
      "+91 63678 51899",
      { title: "Mug", slug: "mug" },
      "https://googlywoogly.art",
    );
    expect(url.startsWith("https://wa.me/916367851899?text=")).toBe(true);
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toContain('"Mug"');
  });

  it("buildOrderPlacedLink encodes the handoff into a wa.me URL", () => {
    const url = buildOrderPlacedLink("916367851899", {
      orderNumber: "GW-2026-00042",
      customerName: "Aanya",
      grandTotal: 100000,
      items: [{ productTitle: "Mug", quantity: 1, lineTotal: 100000 }],
    });
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toContain("Order: GW-2026-00042");
    expect(text).toContain("Total: ₹1,000");
  });
});
