import { describe, it, expect } from "vitest";
import {
  buildOrderReceivedCustomerEmail,
  buildOrderReceivedAdminEmail,
  buildOrderStatusUpdateEmail,
  type OrderEmailData,
} from "./templates";

const baseData: OrderEmailData = {
  storeName: "GooglyWoogly Art",
  orderNumber: "GW-2026-00042",
  placedAtIST: "13 Jun 2026, 2:02 pm",
  customerName: "Aanya Sharma",
  customerEmail: "aanya@example.com",
  customerPhone: "+91 98765 43210",
  items: [
    {
      productTitle: "Hand-painted Mug",
      quantity: 2,
      unitPrice: 79900,
      lineTotal: 159800,
      personalizationNote: "Engrave: Aanya",
    },
    {
      productTitle: "Brass Diya Set",
      quantity: 1,
      unitPrice: 129900,
      lineTotal: 129900,
      madeToOrder: true,
      productionLeadTimeDays: 7,
    },
  ],
  subtotal: 289700,
  shippingFee: 0,
  discountTotal: 0,
  taxTotal: 0,
  grandTotal: 289700,
  shippingAddress: {
    fullName: "Aanya Sharma",
    line1: "12 MI Road",
    city: "Jaipur",
    state: "Rajasthan",
    pincode: "302001",
    phone: "+91 98765 43210",
  },
  giftMessage: "Happy Diwali!",
  trackingUrl: "https://googlywoogly.art/track/abc123token",
  whatsappUrl: "https://wa.me/916367851899?text=hi",
  adminOrderUrl: "https://googlywoogly.art/admin/orders/order_1",
  whatsappCustomerUrl: "https://wa.me/919876543210?text=hi",
};

describe("buildOrderReceivedCustomerEmail", () => {
  const { subject, html } = buildOrderReceivedCustomerEmail(baseData);

  it("subject names the order number and signals WhatsApp confirmation", () => {
    expect(subject).toContain("GW-2026-00042");
    expect(subject.toLowerCase()).toContain("whatsapp");
  });

  it("renders a complete HTML document", () => {
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toMatch(/<\/html>\s*$/);
  });

  it("greets the customer by name and shows the store name", () => {
    expect(html).toContain("Aanya Sharma");
    expect(html).toContain("GooglyWoogly Art");
  });

  it("lists each item with qty and line totals via formatPaise", () => {
    expect(html).toContain("Hand-painted Mug");
    expect(html).toContain("Brass Diya Set");
    expect(html).toContain("Qty 2");
    // ₹1,598 line total (formatPaise renders en-IN grouping)
    expect(html).toContain("₹1,598");
    expect(html).toContain("₹1,299");
    // grand total
    expect(html).toContain("₹2,897");
  });

  it("shows FREE shipping when shippingFee is 0", () => {
    expect(html).toContain("FREE");
  });

  it("carries the 'no payment was taken' reassurance", () => {
    expect(html).toContain("No payment was taken on the site");
  });

  it("renders the shipping address (coarse + line1)", () => {
    expect(html).toContain("12 MI Road");
    expect(html).toContain("Jaipur, Rajasthan 302001");
  });

  it("flags made-to-order items with lead time", () => {
    expect(html).toContain("Made to order");
    expect(html).toContain("~7 days");
  });

  it("includes both WhatsApp and tracking CTAs plus a plaintext track URL", () => {
    expect(html).toContain("https://wa.me/916367851899?text=hi");
    expect(html).toContain("https://googlywoogly.art/track/abc123token");
    expect(html).toContain("Continue on WhatsApp");
  });

  it("echoes the gift message", () => {
    expect(html).toContain("Happy Diwali!");
  });

  it("escapes HTML in user-authored fields (no raw injection)", () => {
    const evil = buildOrderReceivedCustomerEmail({
      ...baseData,
      customerName: "<script>alert(1)</script>",
      giftMessage: "<img src=x onerror=alert(2)>",
    });
    expect(evil.html).not.toContain("<script>alert(1)</script>");
    expect(evil.html).toContain("&lt;script&gt;");
    expect(evil.html).not.toContain("<img src=x");
  });

  it("omits the WhatsApp CTA when no number is configured", () => {
    const noWa = buildOrderReceivedCustomerEmail({ ...baseData, whatsappUrl: null });
    expect(noWa.html).not.toContain("Continue on WhatsApp");
    // tracking CTA still present
    expect(noWa.html).toContain("Track your order");
  });
});

describe("buildOrderReceivedAdminEmail", () => {
  const { subject, html } = buildOrderReceivedAdminEmail(baseData);

  it("subject is scannable: order #, total, customer", () => {
    expect(subject).toContain("GW-2026-00042");
    expect(subject).toContain("₹2,897");
    expect(subject).toContain("Aanya Sharma");
  });

  it("includes customer phone + email for the founder", () => {
    expect(html).toContain("+91 98765 43210");
    expect(html).toContain("aanya@example.com");
  });

  it("links to the admin order and a WhatsApp message to the customer", () => {
    expect(html).toContain("https://googlywoogly.art/admin/orders/order_1");
    expect(html).toContain("https://wa.me/919876543210?text=hi");
    expect(html).toContain("Open in admin");
  });

  it("flags a made-to-order mix for the founder", () => {
    expect(html).toContain("made-to-order");
  });

  it("shows customer + gift notes when present", () => {
    expect(html).toContain("Happy Diwali!");
  });
});

describe("buildOrderStatusUpdateEmail (Phase 4 stub)", () => {
  it("renders an on-brand status note with track + WhatsApp CTAs", () => {
    const { subject, html } = buildOrderStatusUpdateEmail({
      storeName: "GooglyWoogly Art",
      orderNumber: "GW-2026-00042",
      customerName: "Aanya Sharma",
      statusLabel: "Shipped",
      statusMessage: "Your order is on its way!",
      trackingUrl: "https://googlywoogly.art/track/abc123token",
      whatsappUrl: "https://wa.me/916367851899",
    });
    expect(subject).toContain("GW-2026-00042");
    expect(subject).toContain("Shipped");
    expect(html).toContain("Your order is on its way!");
    expect(html).toContain("https://googlywoogly.art/track/abc123token");
    expect(html).toContain("Aanya Sharma");
  });

  it("works without optional CTAs", () => {
    const { html } = buildOrderStatusUpdateEmail({
      storeName: "GooglyWoogly Art",
      orderNumber: "GW-2026-00001",
      customerName: "Test",
      statusLabel: "Confirmed",
      statusMessage: "Confirmed.",
    });
    expect(html).toContain("Confirmed.");
    expect(html).not.toContain("Track your order");
  });
});
