import { describe, it, expect, beforeAll, vi } from "vitest";

// `lib/cloudinary` is `server-only`; that guard throws outside an RSC bundle, so
// stub it to an empty module to exercise the signing helper under vitest (node).
vi.mock("server-only", () => ({}));

describe("signUploadParams", () => {
  let mod: typeof import("./cloudinary");

  beforeAll(async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "testcloud";
    process.env.CLOUDINARY_API_KEY = "123456789";
    process.env.CLOUDINARY_API_SECRET = "test_secret_value";
    process.env.CLOUDINARY_UPLOAD_FOLDER = "googlywoogly/products";
    mod = await import("./cloudinary");
  });

  it("reports enabled when full creds are present", () => {
    expect(mod.cloudinaryEnabled).toBe(true);
  });

  it("signs {timestamp, folder} deterministically as SHA-1 hex", () => {
    const a = mod.signUploadParams({ timestamp: 1700000000 });
    const b = mod.signUploadParams({ timestamp: 1700000000 });
    expect(a.signature).toBe(b.signature); // deterministic for fixed inputs
    expect(a.signature).toMatch(/^[a-f0-9]{40}$/); // Cloudinary uses SHA-1
  });

  it("returns the public params and the default folder, but NEVER the secret", () => {
    const signed = mod.signUploadParams({ timestamp: 1700000000 });
    expect(signed.cloudName).toBe("testcloud");
    expect(signed.apiKey).toBe("123456789");
    expect(signed.folder).toBe("googlywoogly/products");
    // Security: the API secret must never appear in anything sent to the browser.
    expect(JSON.stringify(signed)).not.toContain("test_secret_value");
  });

  it("produces a different signature when the folder changes", () => {
    const a = mod.signUploadParams({ timestamp: 1700000000, folder: "folder-a" });
    const b = mod.signUploadParams({ timestamp: 1700000000, folder: "folder-b" });
    expect(a.signature).not.toBe(b.signature);
  });
});
