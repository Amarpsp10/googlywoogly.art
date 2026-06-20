import { NextResponse, type NextRequest } from "next/server";
// Import the EDGE-SAFE jose crypto only — never `lib/auth/session` (which pulls
// in `server-only` + `next/headers`) or `lib/auth` (which pulls in prisma).
import { verifyToken, SESSION_COOKIE } from "@/lib/auth/jwt";

/**
 * Proxy — the coarse admin auth gate (doc 10 FR-22, layer 1).
 *
 * Next 16 **deprecated the `middleware` file convention in favour of `proxy`**
 * (https://nextjs.org/docs/messages/middleware-to-proxy). This file replaces the
 * old `middleware.ts`: same job, same `config.matcher`, exported as `proxy`.
 * (Proxy runs on the Node.js runtime rather than Edge — our `jose`-only verify
 * works identically there and imports nothing Node-incompatible, so the gate is
 * unchanged and strictly safer.)
 *
 * It verifies the `gw_admin` session JWT with **jose only** (no `prisma`). A
 * valid signature lets the request through; absent/invalid ⇒ 302 to
 * `/admin-login?next={path}`. The *real* authorization (full user load,
 * `isActive`, role matrix) happens server-side in `requireAdmin()` /
 * `requireRole()`.
 *
 * The matcher covers `/admin/:path*` only. The login page lives at
 * `/admin-login` (outside `/admin`), so it is never gated here. Every admin
 * response also gets `X-Robots-Tag: noindex` (doc 10 §8 / CANON §8).
 */

const LOGIN_PATH = "/admin-login";

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = await verifyToken(token);

  if (!payload) {
    const loginUrl = new URL(LOGIN_PATH, req.url);
    // Preserve where the user was headed so login can bounce them back.
    const dest = req.nextUrl.pathname + req.nextUrl.search;
    loginUrl.searchParams.set("next", dest);
    const res = NextResponse.redirect(loginUrl);
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};
