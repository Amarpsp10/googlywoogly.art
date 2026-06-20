import { describe, it, expect } from "vitest";
import {
  bulkInquirySchema,
  contactSchema,
  newsletterSchema,
} from "./leads";

const validBulk = {
  name: "Rohan Mehta",
  phone: "+91 98765 43210",
  email: "Rohan@Example.COM",
  message: "We need 200 branded Diwali hampers.",
};

describe("bulkInquirySchema", () => {
  it("accepts a minimal valid inquiry and normalizes phone + email", () => {
    const r = bulkInquirySchema.safeParse(validBulk);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phone).toBe("9876543210");
      expect(r.data.email).toBe("rohan@example.com");
    }
  });

  it("rejects when required fields are missing", () => {
    expect(bulkInquirySchema.safeParse({}).success).toBe(false);
    // missing message
    expect(
      bulkInquirySchema.safeParse({ ...validBulk, message: undefined }).success,
    ).toBe(false);
    // missing name
    expect(
      bulkInquirySchema.safeParse({ ...validBulk, name: undefined }).success,
    ).toBe(false);
  });

  it("rejects a too-short message", () => {
    const r = bulkInquirySchema.safeParse({ ...validBulk, message: "hi" });
    expect(r.success).toBe(false);
  });

  it("rejects when the honeypot is filled", () => {
    const r = bulkInquirySchema.safeParse({
      ...validBulk,
      website: "http://spam.example",
    });
    expect(r.success).toBe(false);
  });

  it("coerces quantity and budgetRupees from strings; rejects non-positive quantity", () => {
    const r = bulkInquirySchema.safeParse({
      ...validBulk,
      quantity: "150",
      budgetRupees: "50000",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.quantity).toBe(150);
      expect(r.data.budgetRupees).toBe(50000);
    }
    expect(
      bulkInquirySchema.safeParse({ ...validBulk, quantity: 0 }).success,
    ).toBe(false);
    expect(
      bulkInquirySchema.safeParse({ ...validBulk, quantity: 2.5 }).success,
    ).toBe(false);
  });

  it("coerces a deadline date string", () => {
    const r = bulkInquirySchema.safeParse({
      ...validBulk,
      deadline: "2026-10-20",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.deadline).toBeInstanceOf(Date);
  });

  it("treats empty optional fields as absent (empty honeypot is allowed)", () => {
    const r = bulkInquirySchema.safeParse({ ...validBulk, website: "" });
    expect(r.success).toBe(true);
  });
});

describe("contactSchema", () => {
  const validContact = {
    name: "Aarti Sharma",
    email: "aarti@example.com",
    message: "Loved the hand-painted mug, do you ship to Pune?",
  };

  it("accepts a valid message without a phone", () => {
    const r = contactSchema.safeParse(validContact);
    expect(r.success).toBe(true);
  });

  it("normalizes an optional phone when present", () => {
    const r = contactSchema.safeParse({
      ...validContact,
      phone: "09876543210",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe("9876543210");
  });

  it("rejects missing email and missing message", () => {
    expect(
      contactSchema.safeParse({ ...validContact, email: undefined }).success,
    ).toBe(false);
    expect(
      contactSchema.safeParse({ ...validContact, message: "no" }).success,
    ).toBe(false);
  });

  it("rejects when the honeypot is filled", () => {
    const r = contactSchema.safeParse({
      ...validContact,
      website: "bot",
    });
    expect(r.success).toBe(false);
  });
});

describe("newsletterSchema", () => {
  it("accepts a valid email and lowercases it", () => {
    const r = newsletterSchema.safeParse({ email: "Fan@Example.com" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("fan@example.com");
  });

  it("rejects an invalid email", () => {
    expect(newsletterSchema.safeParse({ email: "not-an-email" }).success).toBe(
      false,
    );
  });

  it("rejects when the honeypot is filled", () => {
    const r = newsletterSchema.safeParse({
      email: "fan@example.com",
      website: "spam",
    });
    expect(r.success).toBe(false);
  });
});
