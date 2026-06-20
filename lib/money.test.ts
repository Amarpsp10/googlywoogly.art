import { describe, it, expect } from "vitest";
import {
  rupeesToPaise,
  paiseToRupees,
  formatPaise,
  discountPercent,
} from "./money";

describe("money", () => {
  it("converts rupees to integer paise (rounding)", () => {
    expect(rupeesToPaise(1299)).toBe(129900);
    expect(rupeesToPaise(12.5)).toBe(1250);
    expect(rupeesToPaise(12.555)).toBe(1256); // 1255.5 -> rounds to 1256
  });

  it("converts paise back to rupees", () => {
    expect(paiseToRupees(129900)).toBe(1299);
    expect(paiseToRupees(1250)).toBe(12.5);
  });

  it("formats whole rupees without decimals by default", () => {
    expect(formatPaise(129900)).toBe("₹1,299");
    expect(formatPaise(50000)).toBe("₹500");
  });

  it("formats fractional amounts with decimals (auto)", () => {
    expect(formatPaise(129950)).toBe("₹1,299.50");
  });

  it("respects the always/never decimal modes", () => {
    expect(formatPaise(129900, { showDecimals: "always" })).toBe("₹1,299.00");
    expect(formatPaise(129950, { showDecimals: "never" })).toBe("₹1,300");
  });

  it("uses Indian lakh grouping", () => {
    expect(formatPaise(10000000)).toBe("₹1,00,000");
  });

  it("computes discount percentage", () => {
    expect(discountPercent(80000, 100000)).toBe(20);
    expect(discountPercent(80000, null)).toBe(0);
    expect(discountPercent(80000, 70000)).toBe(0); // compareAt below price -> 0
  });
});
