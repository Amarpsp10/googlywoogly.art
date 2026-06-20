import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { AdminRole } from "@prisma/client";
import type { SessionPayload } from "./types";

/**
 * Pure JWT sign/verify with **jose (HS256)** — **edge-safe** (no `server-only`,
 * no `next/headers`, no `prisma`). This is the only auth module middleware may
 * import, so the Edge bundle stays clean (doc 10: "EDGE-SAFE — verify the
 * cookie's JWT with jose ONLY").
 *
 * `session.ts` (server-only) builds the cookie machinery on top of these.
 */

export const SESSION_COOKIE = "gw_admin";

/** 7 days, in seconds. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const ALG = "HS256";
const ISSUER = "googlywoogly:admin";
const AUDIENCE = "googlywoogly:admin";

/**
 * Derive the signing key from `AUTH_SECRET` at call time (not import time) so a
 * misconfigured deploy fails on the first auth attempt rather than silently
 * issuing unverifiable tokens.
 */
function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short (need ≥16 chars). Set it in the environment.",
    );
  }
  return new TextEncoder().encode(secret);
}

/** Sign a session JWT embedding `{ sub, role }` plus standard time claims. */
export async function signToken(input: {
  id: string;
  role: AdminRole;
}): Promise<string> {
  return new SignJWT({ role: input.role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(input.id)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

/**
 * Verify a session token → `{ sub, role }`, or `null` for any
 * invalid/expired/tampered token. Never throws (callers treat `null` as
 * "unauthenticated").
 */
export async function verifyToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: [ALG],
    });
    return toSessionPayload(payload);
  } catch {
    return null;
  }
}

/** Narrow a verified `JWTPayload` to our `SessionPayload`, or `null` if malformed. */
function toSessionPayload(payload: JWTPayload): SessionPayload | null {
  const sub = payload.sub;
  const role = payload.role;
  if (typeof sub !== "string" || !sub) return null;
  if (role !== "owner" && role !== "admin" && role !== "staff") return null;
  return { sub, role };
}
