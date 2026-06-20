import { describe, it, expect } from "vitest";
import {
  cartItemSchema,
  checkoutContactSchema,
  checkoutSchema,
  CHECKOUT_LIMITS,
} from "./checkout";

const validAddress = {
  fullName: "Aanya Sharma",
  phone: "9876543210",
  line1: "12 MI Road",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302001",
};

const validContact = {
  customerName: "Aanya Sharma",
  customerPhone: "+91 98765 43210",
  customerEmail: "Aanya@Example.com",
};

const baseCheckout = {
  contact: validContact,
  shippingAddress: validAddress,
  items: [{ productId: "prod_1", quantity: 2 }],
  clientRequestId: "3f1d2c4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
};

describe("cartItemSchema", () => {
  it("accepts a minimal valid line", () => {
    const r = cartItemSchema.parse({ productId: "p1", quantity: 1 });
    expect(r.quantity).toBe(1);
  });

  it("accepts personalization + gift notes and trims them", () => {
    const r = cartItemSchema.parse({
      productId: "p1",
      quantity: 3,
      personalizationNote: "  Engrave: Aanya  ",
      giftMessage: "  Happy birthday!  ",
    });
    expect(r.personalizationNote).toBe("Engrave: Aanya");
    expect(r.giftMessage).toBe("Happy birthday!");
  });

  it("rejects quantity below 1, non-integer, and over the cap", () => {
    expect(cartItemSchema.safeParse({ productId: "p1", quantity: 0 }).success).toBe(false);
    expect(cartItemSchema.safeParse({ productId: "p1", quantity: 1.5 }).success).toBe(false);
    expect(
      cartItemSchema.safeParse({
        productId: "p1",
        quantity: CHECKOUT_LIMITS.maxQuantityPerLine + 1,
      }).success,
    ).toBe(false);
  });

  it("rejects an empty productId", () => {
    expect(cartItemSchema.safeParse({ productId: "", quantity: 1 }).success).toBe(false);
  });

  it("rejects an over-long personalization note", () => {
    const note = "x".repeat(CHECKOUT_LIMITS.personalizationNote + 1);
    expect(
      cartItemSchema.safeParse({ productId: "p1", quantity: 1, personalizationNote: note })
        .success,
    ).toBe(false);
  });
});

describe("checkoutContactSchema", () => {
  it("normalizes phone to bare 10 digits and lowercases email", () => {
    const r = checkoutContactSchema.parse(validContact);
    expect(r.customerPhone).toBe("9876543210");
    expect(r.customerEmail).toBe("aanya@example.com");
  });

  it("rejects a 1-char name, bad phone, and bad email", () => {
    expect(checkoutContactSchema.safeParse({ ...validContact, customerName: "A" }).success).toBe(false);
    expect(checkoutContactSchema.safeParse({ ...validContact, customerPhone: "12345" }).success).toBe(false);
    expect(checkoutContactSchema.safeParse({ ...validContact, customerEmail: "nope" }).success).toBe(false);
  });
});

describe("checkoutSchema", () => {
  it("parses a complete valid checkout payload", () => {
    const r = checkoutSchema.parse(baseCheckout);
    expect(r.items).toHaveLength(1);
    expect(r.contact.customerPhone).toBe("9876543210");
    expect(r.shippingAddress.country).toBe("IN"); // defaulted by addressSchema
    expect(r.clientRequestId).toBe(baseCheckout.clientRequestId);
  });

  it("allows omitting clientRequestId (action supplies one)", () => {
    const { clientRequestId, ...rest } = baseCheckout;
    void clientRequestId;
    expect(checkoutSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects an empty items array", () => {
    expect(checkoutSchema.safeParse({ ...baseCheckout, items: [] }).success).toBe(false);
  });

  it("rejects more than the max line items", () => {
    const items = Array.from({ length: CHECKOUT_LIMITS.maxLineItems + 1 }, (_, i) => ({
      productId: `p${i}`,
      quantity: 1,
    }));
    expect(checkoutSchema.safeParse({ ...baseCheckout, items }).success).toBe(false);
  });

  it("rejects an over-long order-level gift message and customer note", () => {
    expect(
      checkoutSchema.safeParse({
        ...baseCheckout,
        giftMessage: "x".repeat(CHECKOUT_LIMITS.orderGiftMessage + 1),
      }).success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({
        ...baseCheckout,
        customerNote: "x".repeat(CHECKOUT_LIMITS.customerNote + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects a non-uuid clientRequestId", () => {
    expect(
      checkoutSchema.safeParse({ ...baseCheckout, clientRequestId: "not-a-uuid" }).success,
    ).toBe(false);
  });

  it("rejects an invalid shipping address (unknown state)", () => {
    expect(
      checkoutSchema.safeParse({
        ...baseCheckout,
        shippingAddress: { ...validAddress, state: "Atlantis" },
      }).success,
    ).toBe(false);
  });

  it("surfaces nested field errors via flatten on the contact branch", () => {
    const r = checkoutSchema.safeParse({
      ...baseCheckout,
      contact: { ...validContact, customerEmail: "bad" },
    });
    expect(r.success).toBe(false);
  });

  // Guards the checkout-form server-error mapping: `placeOrder` returns
  // `flatten().fieldErrors`, whose keys for nested objects are the TOP-LEVEL
  // group names (`contact`, `shippingAddress`) — NOT the dotted leaf paths RHF
  // registers. The form must remap these onto a rendered input; setting an
  // error on `contact`/`shippingAddress` directly would never render.
  it("flatten() returns top-level group keys for nested validation errors", () => {
    const r = checkoutSchema.safeParse({
      ...baseCheckout,
      contact: { ...validContact, customerEmail: "bad" },
      shippingAddress: { ...validAddress, pincode: "12" },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const keys = Object.keys(r.error.flatten().fieldErrors);
      expect(keys).toContain("contact");
      expect(keys).toContain("shippingAddress");
      // Importantly NOT the dotted RHF paths the form would otherwise expect.
      expect(keys).not.toContain("contact.customerEmail");
      expect(keys).not.toContain("shippingAddress.pincode");
    }
  });
});

// The exact schema the checkout form's `zodResolver` validates against:
// `checkoutSchema` minus the cart-built fields. These assert the submit button
// can actually become reachable (resolver passes a filled form) and that a
// missing required field is rejected with a surfaced error.
describe("checkoutFormSchema (react-hook-form resolver target)", () => {
  const checkoutFormSchema = checkoutSchema.omit({
    items: true,
    clientRequestId: true,
  });

  const filledForm = {
    contact: validContact,
    shippingAddress: validAddress,
    customerNote: "",
    giftMessage: "",
  };

  it("accepts a fully-filled form (so the resolver never blocks submit)", () => {
    expect(checkoutFormSchema.safeParse(filledForm).success).toBe(true);
  });

  it("rejects a missing required field and reports it under its group", () => {
    const r = checkoutFormSchema.safeParse({
      ...filledForm,
      shippingAddress: { ...validAddress, state: undefined },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(Object.keys(r.error.flatten().fieldErrors)).toContain(
        "shippingAddress",
      );
    }
  });
});
