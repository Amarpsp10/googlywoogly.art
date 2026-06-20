"use server";

import { performLogout } from "@/lib/auth";

/**
 * Admin shell Server Actions. Kept in a dedicated `"use server"` module so the
 * client `LogoutButton` can import the action without pulling the `server-only`
 * `@/lib/auth` module into the client bundle (matches the project's
 * `app/actions/*` convention).
 */

/** Sign out: clear the session cookie and redirect to `/admin-login`. */
export async function logoutAction(): Promise<void> {
  await performLogout();
}
