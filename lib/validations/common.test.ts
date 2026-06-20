import { describe, it, expect } from "vitest";
import { phoneSchema, pincodeSchema, addressSchema } from "./common";

describe("phoneSchema", () => {
  it("normalizes prefixes to a bare 10-digit number", () => {
    expect(phoneSchema.parse("+91 98765 43210")).toBe("9876543210");
    expect(phoneSchema.parse("09876543210")).toBe("9876543210");
    expect(phoneSchema.parse("91-9876543210")).toBe("9876543210");
  });
  it("does not strip a leading 9 from a genuine 10-digit number", () => {
    expect(phoneSchema.parse("9176543210")).toBe("9176543210");
  });
  it("rejects invalid numbers", () => {
    expect(phoneSchema.safeParse("12345").success).toBe(false);
    expect(phoneSchema.safeParse("5876543210").success).toBe(false); // must start 6-9
  });
});

describe("pincodeSchema", () => {
  it("accepts 6-digit pincodes not starting with 0", () => {
    expect(pincodeSchema.parse("302001")).toBe("302001");
  });
  it("rejects bad pincodes", () => {
    expect(pincodeSchema.safeParse("012345").success).toBe(false);
    expect(pincodeSchema.safeParse("3020011").success).toBe(false);
  });
});

describe("addressSchema", () => {
  it("validates a complete Indian address and defaults country", () => {
    const parsed = addressSchema.parse({
      fullName: "Vanshika Bhatia",
      phone: "9876543210",
      line1: "12 Pink City Lane",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302001",
    });
    expect(parsed.country).toBe("IN");
    expect(parsed.state).toBe("Rajasthan");
  });
  it("rejects an unknown state", () => {
    const r = addressSchema.safeParse({
      fullName: "A B",
      phone: "9876543210",
      line1: "12 Lane",
      city: "Nowhere",
      state: "Atlantis",
      pincode: "302001",
    });
    expect(r.success).toBe(false);
  });
});
