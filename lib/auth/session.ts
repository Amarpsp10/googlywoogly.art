import "server-only";

import { cookies } from "next/headers";
import type { AdminUser, SessionPayload } from "./types";
import {
  signToken,
  verifyToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "./jwt";

/**
 * Server-only session layer — the cookie machinery for the admin session,
 * built on the **edge-safe** jose crypto in `./jwt`. Middleware imports `./jwt`
 * directly (Edge runtime); RSC/Server-Action code imports this module (which can
 * read/write cookies via `next/headers`).
 *
 * Cookie: name `gw_admin`, `httpOnly`, `secure` in prod, `sameSite=lax`,
 * `path=/`, ~7-day expiry.
 */

// Re-export the edge-safe crypto + cookie name so existing call sites keep one
// import surface.
export { signToken, verifyToken, SESSION_COOKIE };

/**
 * Should the session cookie carry the `Secure` flag?
 *
 * A `Secure` cookie is sent back ONLY over HTTPS, so on a plain-HTTP origin
 * (local testing over `http://revnew.local:3800`, a LAN IP, etc.) it would be set
 * but never returned — logging you out on every navigation. So tie the flag to
 * the scheme the app is actually served over (`NEXT_PUBLIC_SITE_URL`): HTTPS →
 * `Secure` (real deployments stay protected); HTTP → not `Secure` (local testing
 * keeps the session). Falls back to `NODE_ENV` only when the URL is unset.
 */
function useSecureCookie(): boolean {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (url.startsWith("https://")) return true;
  if (url.startsWith("http://")) return false;
  return process.env.NODE_ENV === "production";
}

/** Read the raw session token from the `gw_admin` cookie (server-side). */
export async function readSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

/**
 * Issue a session cookie for the given admin. Called from the login path after a
 * successful password check (`lib/auth/index.ts`).
 */
export async function setSession(admin: Pick<AdminUser, "id" | "role">): Promise<void> {
  const token = await signToken({ id: admin.id, role: admin.role });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: useSecureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Clear the session cookie (logout). */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: useSecureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Read + verify the current request's session payload (or `null`). */
export async function getSessionPayload(): Promise<SessionPayload | null> {
  return verifyToken(await readSessionToken());
}
