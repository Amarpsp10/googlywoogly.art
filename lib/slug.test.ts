import { describe, it, expect } from "vitest";
import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it("kebab-cases and lowercases", () => {
    expect(slugify("Hand-Painted Ceramic Mug!")).toBe("hand-painted-ceramic-mug");
  });
  it("collapses separators and trims hyphens", () => {
    expect(slugify("  Diwali   Gift  Set  ")).toBe("diwali-gift-set");
    expect(slugify("--weird__slug--")).toBe("weird-slug");
  });
  it("strips diacritics", () => {
    expect(slugify("Café Décor")).toBe("cafe-decor");
  });
});

describe("uniqueSlug", () => {
  it("returns the base when free", async () => {
    expect(await uniqueSlug("Brass Diya", async () => false)).toBe("brass-diya");
  });
  it("appends an incrementing suffix when taken", async () => {
    const taken = new Set(["brass-diya", "brass-diya-2"]);
    expect(await uniqueSlug("Brass Diya", async (c) => taken.has(c))).toBe(
      "brass-diya-3",
    );
  });
  it("lets an entity keep its own slug", async () => {
    expect(
      await uniqueSlug("Brass Diya", async () => true, "brass-diya"),
    ).toBe("brass-diya");
  });
});
