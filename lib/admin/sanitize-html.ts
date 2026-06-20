import "server-only";

/**
 * Dependency-free, allow-list HTML sanitizer for admin-authored rich bodies
 * (doc 15 FR-28). Every CMS/FAQ/section rich-text write passes through this on
 * the **server** before persistence — the client editor's constraints are never
 * trusted (FR-28 "sanitization happens server-side regardless of client").
 *
 * Scope is deliberately small (MVP stores HTML in a `Textarea`, no Tiptap dep):
 *  - Allowed tags: `h2 h3 p ul ol li a strong b em i blockquote hr br img figure
 *    figcaption` (doc 15 FR-28). `b`/`i` are normalised to `strong`/`em`.
 *  - Allowed attrs: `a[href]` (http/https/mailto/tel only; `rel`/`target`
 *    normalised), `img[src|alt|width|height]` (https only).
 *  - Everything else — `<script>`, `<style>`, `<iframe>`, event handlers,
 *    inline styles, unknown tags/attrs — is stripped.
 *
 * This is a conservative tag-walker, not a full HTML5 parser; it errs toward
 * dropping anything it doesn't explicitly allow. The storefront renders the
 * already-sanitized string (doc 15 §6.6) so this is the single trust boundary.
 */

/** Tags kept in the output (lowercase). */
const ALLOWED_TAGS = new Set([
  "h2",
  "h3",
  "p",
  "ul",
  "ol",
  "li",
  "a",
  "strong",
  "em",
  "blockquote",
  "hr",
  "br",
  "img",
  "figure",
  "figcaption",
]);

/** Tags whose *content* is dropped wholesale (not just the tag). */
const VOID_DANGEROUS = new Set(["script", "style", "iframe", "object", "embed", "noscript"]);

/** Self-closing tags that never carry children. */
const SELF_CLOSING = new Set(["br", "hr", "img"]);

/** `b`→`strong`, `i`→`em` so storefront styling stays uniform (doc 15 FR-28). */
const TAG_ALIASES: Record<string, string> = { b: "strong", i: "em" };

/** Per-tag attribute allow-list. Anything not listed is stripped. */
const ALLOWED_ATTRS: Record<string, ReadonlySet<string>> = {
  a: new Set(["href"]),
  img: new Set(["src", "alt", "width", "height"]),
};

/** Decode the handful of entities we care about for URL-scheme checks. */
function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

/** Escape a raw attribute value for safe re-emission inside double quotes. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** A link `href` is safe iff it is a relative path or http/https/mailto/tel. */
function safeHref(raw: string): string | null {
  const value = decodeEntities(raw).trim();
  if (value.startsWith("/") || value.startsWith("#")) return value;
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  return null;
}

/** An image `src` is safe iff it is an https(s) URL or an app-relative path. */
function safeSrc(raw: string): string | null {
  const value = decodeEntities(raw).trim();
  if (value.startsWith("/")) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}

/** Parse an opening-tag's attribute string into `name → value` pairs. */
function parseAttrs(attrString: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(attrString)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? "";
    if (!attrs.has(name)) attrs.set(name, value);
  }
  return attrs;
}

/** Rebuild a sanitized attribute list for `tag` from its raw attributes. */
function sanitizeAttrs(tag: string, attrString: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed) return "";

  const attrs = parseAttrs(attrString);
  const out: string[] = [];

  for (const [name, value] of attrs) {
    if (name.startsWith("on")) continue; // event handlers — always drop
    if (!allowed.has(name)) continue;

    if (tag === "a" && name === "href") {
      const href = safeHref(value);
      if (href) out.push(`href="${escapeAttr(href)}"`);
      continue;
    }
    if (tag === "img" && name === "src") {
      const src = safeSrc(value);
      if (src) out.push(`src="${escapeAttr(src)}"`);
      continue;
    }
    if (tag === "img" && (name === "width" || name === "height")) {
      if (/^\d{1,5}$/.test(value.trim())) out.push(`${name}="${escapeAttr(value.trim())}"`);
      continue;
    }
    // alt and any other allow-listed plain attr.
    out.push(`${name}="${escapeAttr(value)}"`);
  }

  // Normalise links: external links get rel + target (doc 15 FR-28).
  if (tag === "a") {
    const hasHref = out.some((a) => a.startsWith("href="));
    if (!hasHref) return ""; // an anchor with no safe href is unwrapped by caller
    out.push('rel="nofollow noopener"');
    out.push('target="_blank"');
  }

  return out.length ? " " + out.join(" ") : "";
}

/**
 * Sanitize an HTML fragment to the allow-list (doc 15 FR-28). Returns trimmed,
 * safe HTML; returns `""` for empty/whitespace-only input.
 */
export function sanitizeRichHtml(input: string): string {
  if (!input) return "";

  // 1) Strip dangerous element bodies entirely (script/style/iframe/…).
  let html = input;
  for (const tag of VOID_DANGEROUS) {
    html = html.replace(new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "");
    html = html.replace(new RegExp(`<${tag}[^>]*>`, "gi"), "");
  }
  // 2) Drop comments and any DOCTYPE/processing instructions.
  html = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<![\s\S]*?>/g, "");

  // 3) Walk tags, keeping only allow-listed ones with sanitized attributes.
  const out: string[] = [];
  const openStack: string[] = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html)) !== null) {
    // Emit (escaped) text between the previous tag and this one.
    out.push(escapeText(html.slice(lastIndex, match.index)));
    lastIndex = tagRe.lastIndex;

    const isClose = match[0].startsWith("</");
    const rawName = match[1].toLowerCase();
    const name = TAG_ALIASES[rawName] ?? rawName;

    if (!ALLOWED_TAGS.has(name)) continue; // unknown tag → drop the tag, keep text

    if (isClose) {
      // Only close if it matches an open tag we emitted (avoid stray closers).
      const idx = openStack.lastIndexOf(name);
      if (idx === -1) continue;
      // Close any intervening unclosed inline tags too.
      while (openStack.length > idx) {
        out.push(`</${openStack.pop()}>`);
      }
      continue;
    }

    const attrs = sanitizeAttrs(name, match[2] ?? "");
    if (name === "a" && attrs === "") {
      // Anchor with no safe href: skip the tag but keep its text content.
      continue;
    }

    if (SELF_CLOSING.has(name)) {
      out.push(`<${name}${attrs} />`);
    } else {
      out.push(`<${name}${attrs}>`);
      openStack.push(name);
    }
  }
  // Trailing text after the last tag.
  out.push(escapeText(html.slice(lastIndex)));
  // Close anything left open.
  while (openStack.length) out.push(`</${openStack.pop()}>`);

  return out.join("").trim();
}

/** Escape text nodes so stray `<`/`&`/`>` can't re-open the parser. */
function escapeText(text: string): string {
  return text.replace(/&(?!(amp|lt|gt|quot|#\d+|#x[0-9a-f]+);)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Plain-text projection of sanitized HTML — used to validate that a rich body
 * isn't "only formatting" (doc 15 FR-17/FR-29) and for JSON-LD elsewhere.
 */
export function richTextToPlain(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}
