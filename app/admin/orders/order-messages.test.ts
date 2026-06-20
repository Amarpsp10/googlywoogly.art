// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  composeEventNote,
  primaryChannel,
  buildStatusWhatsAppMessage,
  buildStatusWhatsAppLink,
  NOTIFY_DEFAULTS,
  PRIMARY_NEXT,
  advanceLabel,
  COURIERS,
} from "./order-messages";

/**
 * Unit tests for the PURE order-management helpers (docs/12 FR-6/FR-16/FR-18).
 * These power both the Server Actions and the client status control, so their
 * correctness (note composition, channel priority, status-specific WhatsApp
 * bodies, defaults) is the highest-value testable surface in this feature.
 */

describe("composeEventNote", () => {
  it("renders a recognisable ship prefix from courier + tracking (FR-6)", () => {
    expect(
      composeEventNote({
        toStatus: "shipped",
        shipping: { courierName: "Delhivery", trackingNumber: "AWB123" },
      }),
    ).toBe("Shipped via Delhivery · Tracking AWB123");
  });

  it("appends a cancel/hold reason but not for other statuses", () => {
    expect(
      composeEventNote({ toStatus: "cancelled", reason: "Item unavailable" }),
    ).toBe("Reason: Item unavailable");
    // A reason on a non-cancel/hold transition is ignored.
    expect(
      composeEventNote({ toStatus: "confirmed", reason: "ignored" }),
    ).toBeNull();
  });

  it("combines ship + note with the em-dash separator", () => {
    expect(
      composeEventNote({
        toStatus: "shipped",
        shipping: { courierName: "DTDC", trackingNumber: "X1" },
        note: "Left at reception",
      }),
    ).toBe("Shipped via DTDC · Tracking X1 — Left at reception");
  });

  it("returns null when there is nothing to store", () => {
    expect(composeEventNote({ toStatus: "confirmed" })).toBeNull();
    expect(composeEventNote({ toStatus: "confirmed", note: "   " })).toBeNull();
  });
});

describe("primaryChannel (FR-16: email > sms > whatsapp)", () => {
  it("prefers email when multiple channels chosen", () => {
    expect(primaryChannel({ email: true, whatsapp: true, sms: true })).toBe("email");
  });
  it("falls back to sms, then whatsapp", () => {
    expect(primaryChannel({ email: false, whatsapp: true, sms: true })).toBe("sms");
    expect(primaryChannel({ email: false, whatsapp: true, sms: false })).toBe(
      "whatsapp",
    );
  });
  it("is null when nothing chosen", () => {
    expect(primaryChannel({ email: false, whatsapp: false, sms: false })).toBeNull();
  });
});

describe("buildStatusWhatsAppMessage (FR-18)", () => {
  const base = {
    customerPhone: "+91 98765 43210",
    customerName: "Aanya Sharma",
    orderNumber: "GW-2026-00042",
    trackUrl: "https://shop.test/track/tok123",
    storeName: "GooglyWoogly Art",
  };

  it("greets by first name and includes the order number + track URL on confirm", () => {
    const msg = buildStatusWhatsAppMessage({ ...base, toStatus: "confirmed" });
    expect(msg).toContain("Hi Aanya!");
    expect(msg).toContain("GW-2026-00042");
    expect(msg).toContain("https://shop.test/track/tok123");
  });

  it("includes courier + tracking and prefers the courier trackingUrl on shipped", () => {
    const msg = buildStatusWhatsAppMessage({
      ...base,
      toStatus: "shipped",
      courierName: "Blue Dart",
      trackingNumber: "BD999",
      trackingUrl: "https://bluedart.test/BD999",
    });
    expect(msg).toContain("Blue Dart");
    expect(msg).toContain("BD999");
    expect(msg).toContain("https://bluedart.test/BD999");
  });

  it("weaves the reason into the cancelled/on_hold bodies", () => {
    expect(
      buildStatusWhatsAppMessage({ ...base, toStatus: "cancelled", reason: "Out of stock" }),
    ).toContain("(Out of stock)");
    expect(
      buildStatusWhatsAppMessage({ ...base, toStatus: "on_hold", reason: "Awaiting detail" }),
    ).toContain(": Awaiting detail");
  });

  it("falls back to 'there' when the name is blank", () => {
    expect(
      buildStatusWhatsAppMessage({ ...base, customerName: "  ", toStatus: "delivered" }),
    ).toContain("Hi there!");
  });
});

describe("buildStatusWhatsAppLink", () => {
  it("produces a wa.me link with digits-only number + encoded text", () => {
    const link = buildStatusWhatsAppLink({
      customerPhone: "+91 98765 43210",
      customerName: "Aanya",
      orderNumber: "GW-1",
      toStatus: "confirmed",
      trackUrl: "https://shop.test/track/x",
      storeName: "Store",
    });
    expect(link.startsWith("https://wa.me/919876543210?text=")).toBe(true);
  });

  it("returns '' when there is no usable number (CTA hidden)", () => {
    expect(
      buildStatusWhatsAppLink({
        customerPhone: "",
        customerName: "Aanya",
        orderNumber: "GW-1",
        toStatus: "confirmed",
        trackUrl: "https://shop.test/track/x",
        storeName: "Store",
      }),
    ).toBe("");
  });
});

describe("defaults & labels", () => {
  it("matches the FR-15 default notification policy", () => {
    expect(NOTIFY_DEFAULTS.confirmed).toEqual({ email: true, whatsapp: true });
    expect(NOTIFY_DEFAULTS.shipped).toEqual({ email: true, whatsapp: true });
    // ready_to_ship is an internal milestone — no default notification.
    expect(NOTIFY_DEFAULTS.ready_to_ship).toEqual({ email: false, whatsapp: false });
  });

  it("maps the most-likely next step (FR-27)", () => {
    expect(PRIMARY_NEXT.pending_confirmation).toBe("confirmed");
    expect(PRIMARY_NEXT.ready_to_ship).toBe("shipped");
    expect(PRIMARY_NEXT.shipped).toBe("delivered");
  });

  it("labels known targets and falls back for the rest", () => {
    expect(advanceLabel("shipped", "Shipped")).toBe("Mark shipped");
    expect(advanceLabel("on_hold", "On hold")).toBe("Move to On hold");
  });

  it("offers the documented courier picklist (FR-6)", () => {
    expect(COURIERS).toContain("Delhivery");
    expect(COURIERS).toContain("India Post");
    expect(COURIERS[COURIERS.length - 1]).toBe("Other");
  });
});
