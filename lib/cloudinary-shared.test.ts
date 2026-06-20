import { describe, it, expect } from "vitest";
import {
  publicIdFromUrl,
  isCloudinaryUrl,
  UPLOAD_MAX_BYTES,
  UPLOAD_ALLOWED_MIME,
} from "./cloudinary-shared";

describe("isCloudinaryUrl", () => {
  it("detects Cloudinary delivery URLs", () => {
    expect(
      isCloudinaryUrl("https://res.cloudinary.com/dpkugi3fd/image/upload/v1/a/b.png"),
    ).toBe(true);
  });
  it("rejects non-Cloudinary URLs and empties", () => {
    expect(isCloudinaryUrl("https://picsum.photos/seed/x/900/900")).toBe(false);
    expect(isCloudinaryUrl("https://example.com/res.cloudinary.com.png")).toBe(false);
    expect(isCloudinaryUrl(null)).toBe(false);
    expect(isCloudinaryUrl(undefined)).toBe(false);
    expect(isCloudinaryUrl("")).toBe(false);
  });
});

describe("publicIdFromUrl", () => {
  it("extracts a foldered publicId from a versioned upload URL (real shape)", () => {
    // Exactly the secure_url shape Cloudinary returned during live verification.
    expect(
      publicIdFromUrl(
        "https://res.cloudinary.com/dpkugi3fd/image/upload/v1781419192/googlywoogly/products/vlkac789ve5ovkhrzgmo.png",
      ),
    ).toBe("googlywoogly/products/vlkac789ve5ovkhrzgmo");
  });

  it("handles a URL with no version segment", () => {
    expect(
      publicIdFromUrl("https://res.cloudinary.com/demo/image/upload/folder/name.jpg"),
    ).toBe("folder/name");
  });

  it("strips a transformation prefix ahead of the version", () => {
    expect(
      publicIdFromUrl(
        "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v123/products/mug.webp",
      ),
    ).toBe("products/mug");
  });

  it("returns null for non-Cloudinary or missing URLs", () => {
    expect(publicIdFromUrl("https://picsum.photos/seed/x/900/900")).toBeNull();
    expect(publicIdFromUrl(null)).toBeNull();
    expect(publicIdFromUrl(undefined)).toBeNull();
    expect(publicIdFromUrl("")).toBeNull();
  });
});

describe("upload limits", () => {
  it("caps at 10 MB and allows the four web image formats", () => {
    expect(UPLOAD_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(UPLOAD_ALLOWED_MIME).toEqual([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/avif",
    ]);
  });
});
