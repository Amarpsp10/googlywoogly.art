// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

// `sanitize-html.ts` is `server-only`; neutralise the guard in tests.
vi.mock("server-only", () => ({}));

import { sanitizeRichHtml, richTextToPlain } from "./sanitize-html";

/**
 * Security-critical: the allow-list sanitizer is the single trust boundary for
 * admin-authored rich bodies (doc 15 FR-28). These tests assert dangerous markup
 * is stripped and the allowed subset is preserved.
 */
describe("sanitizeRichHtml — XSS / dangerous markup", () => {
  it("removes <script> blocks entirely (tag + content)", () => {
    const out = sanitizeRichHtml('<p>Hi</p><script>alert(1)</script>');
    expect(out).not.toMatch(/script/i);
    expect(out).not.toMatch(/alert/);
    expect(out).toContain("<p>Hi</p>");
  });

  it("removes <iframe> and <style> blocks", () => {
    const out = sanitizeRichHtml('<style>body{display:none}</style><iframe src="evil"></iframe><p>ok</p>');
    expect(out).not.toMatch(/iframe|style/i);
    expect(out).toContain("<p>ok</p>");
  });

  it("strips inline event handlers from allowed tags", () => {
    const out = sanitizeRichHtml('<p onclick="steal()">text</p>');
    expect(out).not.toMatch(/onclick/i);
    expect(out).toContain("text");
  });

  it("drops javascript: hrefs on links (unwraps to text)", () => {
    const out = sanitizeRichHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/<a/i);
    expect(out).toContain("click");
  });

  it("keeps safe http/https/mailto links and adds rel/target", () => {
    const out = sanitizeRichHtml('<a href="https://example.com">site</a>');
    expect(out).toContain('href="https://example.com"');
    expect(out).toMatch(/rel="nofollow noopener"/);
    expect(out).toMatch(/target="_blank"/);
  });

  it("keeps relative links", () => {
    const out = sanitizeRichHtml('<a href="/products">shop</a>');
    expect(out).toContain('href="/products"');
  });

  it("drops non-https image sources", () => {
    const out = sanitizeRichHtml('<img src="javascript:1" alt="x">');
    // No src means the img is emitted without it (alt retained) but never with the bad scheme.
    expect(out).not.toMatch(/javascript/i);
  });

  it("keeps https images with alt/width/height", () => {
    const out = sanitizeRichHtml('<img src="https://cdn.test/a.jpg" alt="A" width="100" height="50">');
    expect(out).toContain('src="https://cdn.test/a.jpg"');
    expect(out).toContain('alt="A"');
    expect(out).toContain('width="100"');
  });
});

describe("sanitizeRichHtml — allowed subset & normalisation", () => {
  it("preserves headings, lists, emphasis, blockquote", () => {
    const html = "<h2>Title</h2><ul><li>one</li></ul><blockquote>q</blockquote><strong>b</strong><em>i</em>";
    const out = sanitizeRichHtml(html);
    expect(out).toContain("<h2>Title</h2>");
    expect(out).toContain("<li>one</li>");
    expect(out).toContain("<blockquote>q</blockquote>");
    expect(out).toContain("<strong>b</strong>");
  });

  it("normalises <b>/<i> to <strong>/<em>", () => {
    const out = sanitizeRichHtml("<b>bold</b><i>ital</i>");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>ital</em>");
    expect(out).not.toMatch(/<b>|<i>/);
  });

  it("strips disallowed tags but keeps their text", () => {
    const out = sanitizeRichHtml("<div><span>kept</span></div>");
    expect(out).not.toMatch(/<div|<span/);
    expect(out).toContain("kept");
  });

  it("escapes stray angle brackets in text", () => {
    const out = sanitizeRichHtml("<p>5 < 6 and 7 > 2</p>");
    expect(out).toContain("&lt;");
    expect(out).toContain("&gt;");
  });

  it("returns empty string for empty/whitespace input", () => {
    expect(sanitizeRichHtml("")).toBe("");
    expect(sanitizeRichHtml("   ")).toBe("");
  });

  it("closes unbalanced open tags", () => {
    const out = sanitizeRichHtml("<p>unclosed");
    expect(out).toBe("<p>unclosed</p>");
  });
});

describe("richTextToPlain", () => {
  it("strips tags and collapses whitespace", () => {
    expect(richTextToPlain("<h2>Hi</h2><p>there  friend</p>")).toBe("Hi there friend");
  });

  it("is empty for formatting-only content", () => {
    expect(richTextToPlain("<p></p><br>")).toBe("");
  });
});
