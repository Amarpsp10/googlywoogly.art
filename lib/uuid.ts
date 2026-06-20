/**
 * Generate an RFC-4122 v4 UUID that works in EVERY browser context.
 *
 * `crypto.randomUUID()` is defined only in **secure contexts** (HTTPS or
 * `localhost`). When the app is opened over a plain-HTTP LAN IP — e.g.
 * `http://192.168.1.50:3000`, which `next start`/`next dev` also serve — it is
 * `undefined`, so calling it throws `crypto.randomUUID is not a function` and
 * (in the checkout form) the submit handler dies before any validation runs.
 *
 * `crypto.getRandomValues()` has no secure-context restriction, so we fall back
 * to it and assemble a valid v4 UUID by hand; only if Web Crypto is entirely
 * absent (never in a real browser) do we drop to a `Math.random` path. The output
 * always satisfies `z.string().uuid()`.
 */
export function safeRandomUUID(): string {
  const c: Crypto | undefined =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }

  if (c && typeof c.getRandomValues === "function") {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
    return (
      `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-` +
      `${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`
    );
  }

  // Last resort — no Web Crypto at all (not a real browser scenario).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
