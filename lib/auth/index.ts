import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { ok, fail, type ActionResult } from "@/lib/result";
import {
  getSessionPayload,
  setSession,
  clearSession,
} from "./session";
import {
  roleAllowed,
  type AdminRole,
  type AdminUser,
} from "./types";

/**
 * Admin auth entrypoint — the CONTRACT surface feature agents import as
 * `@/lib/auth`. Custom credentials auth (no `next-auth`):
 *  - `getCurrentAdmin()` reads + verifies the session cookie, then loads the
 *    full `AdminUser` from the DB (null when missing/invalid/inactive).
 *  - `requireAdmin()` / `requireRole()` are the **server-side** authz gates
 *    every admin page (RSC) and Server Action MUST call (doc 10 FR-22/24).
 *  - `loginWithPassword()` verifies the password with bcrypt, applies light
 *    lockout, and sets the session.
 *  - `performLogout()` clears the session and bounces to the login page (the
 *    bound Server Action wrapper lives in `app/admin/actions.ts`).
 *
 * Re-exports the edge-safe role helpers/types so callers have one import.
 */

export type { AdminUser, AdminRole };
export {
  roleAtLeast,
  roleAllowed,
  hidesFinancials,
  ROLE_LABEL,
  ROLE_RANK,
} from "./types";
export { SESSION_COOKIE } from "./session";

/** Public login route — bare auth layout, not under `app/admin`. */
export const LOGIN_PATH = "/admin-login";

/** Generic, non-enumerating credential error (doc 10 FR-9). */
const INVALID_CREDENTIALS = "Invalid email or password.";

/** Account-lockout policy (doc 10 FR-12). */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * Load the current admin for this request (deduped per render via React
 * `cache()` so the layout + page + nested loaders share one DB read).
 *
 * Returns `null` when there is no valid session, the referenced admin no longer
 * exists, or the admin has been deactivated (`isActive=false`) — a deactivated
 * user is therefore forced to re-login on their next request (doc 10 FR-24).
 */
export const getCurrentAdmin = cache(async (): Promise<AdminUser | null> => {
  const payload = await getSessionPayload();
  if (!payload) return null;

  const admin = await prisma.adminUser.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
    },
  });

  if (!admin || !admin.isActive) return null;
  return admin;
});

/**
 * Require any authenticated, active admin. Redirects to the login page (with a
 * `next` param so the user returns after signing in) when unauthenticated.
 * Use in every `app/admin/*` page/layout and at the top of every admin action.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect(LOGIN_PATH);
  return admin;
}

/**
 * Require the current admin to hold one of `roles`. Unauthenticated ⇒ redirect
 * to login; authenticated-but-insufficient ⇒ redirect to the in-app 403 screen
 * (no redirect loop, doc 10 FR-24 / §4.9). Server-side enforcement is the real
 * gate — UI gating is defense-in-depth only.
 */
export async function requireRole(roles: readonly AdminRole[]): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (!roleAllowed(admin.role, roles)) redirect("/admin/no-access");
  return admin;
}

/**
 * Verify credentials and start a session. Always returns an `ActionResult`
 * (never throws across the boundary). On any failure path the message is the
 * generic `INVALID_CREDENTIALS` (anti-enumeration), except an active lockout
 * which surfaces the remaining minutes.
 *
 * Light lockout (doc 10 FR-12, persisted on `AdminUser`): 5 consecutive
 * failures lock the account for 15 minutes; a success resets the counter and
 * stamps `lastLoginAt`. A bcrypt compare runs even for unknown emails to blunt
 * the timing oracle (doc 10 FR-15).
 */
export async function loginWithPassword(
  email: string,
  password: string,
): Promise<ActionResult<void>> {
  const normalizedEmail = email.trim().toLowerCase();

  const admin = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      role: true,
      isActive: true,
      passwordHash: true,
      failedLoginCount: true,
      lockedUntil: true,
    },
  });

  // Constant-ish time even for unknown emails: compare against a throwaway hash
  // so a missing account doesn't return measurably faster (doc 10 FR-15).
  if (!admin) {
    await bcrypt.compare(password, DUMMY_HASH);
    return fail(INVALID_CREDENTIALS);
  }

  // Active lockout window?
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    const minutes = Math.max(
      1,
      Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 60_000),
    );
    return fail(`Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }

  const passwordOk = await bcrypt.compare(password, admin.passwordHash);

  // Treat an inactive account exactly like a bad credential (no enumeration),
  // but only after the bcrypt compare so timing stays uniform.
  if (!passwordOk || !admin.isActive) {
    await registerFailedAttempt(admin.id, admin.failedLoginCount);
    return fail(INVALID_CREDENTIALS);
  }

  // Success: reset lockout counters, stamp lastLoginAt, issue the session.
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  await setSession({ id: admin.id, role: admin.role });
  return ok(undefined);
}

/**
 * Increment the failed-attempt counter and trip a lockout once the threshold is
 * reached. Best-effort: a DB hiccup here must not surface a different error to
 * the user (which would leak account existence), so failures are swallowed.
 */
async function registerFailedAttempt(
  adminId: string,
  currentCount: number,
): Promise<void> {
  const nextCount = currentCount + 1;
  const locked = nextCount >= MAX_FAILED_ATTEMPTS;
  try {
    await prisma.adminUser.update({
      where: { id: adminId },
      data: {
        failedLoginCount: locked ? 0 : nextCount,
        lockedUntil: locked
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
          : undefined,
      },
    });
  } catch {
    // swallow — never change the response shape on the failure path
  }
}

/**
 * A fixed valid bcrypt hash (of a random string) used only to spend comparable
 * CPU time on unknown-email logins. Not a real credential.
 */
const DUMMY_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEeO3eVna5BCQ1uVcv3kVxQ9F3M5Rj1qf2y";

/**
 * Sign out: clear the session cookie and redirect to login. This is a plain
 * server helper (not a Server Action) — the bound Server Action lives in
 * `app/admin/actions.ts` (a `"use server"` module) so client components can
 * import it without pulling this `server-only` module into their bundle.
 */
export async function performLogout(): Promise<never> {
  await clearSession();
  redirect(LOGIN_PATH);
}
