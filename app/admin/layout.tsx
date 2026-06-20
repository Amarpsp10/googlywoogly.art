import type { ReactNode } from "react";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getNavBadges } from "@/lib/admin/nav-badges";
import { getSiteSettings } from "@/lib/services/settings";
import { AdminShell } from "@/components/admin/admin-shell";

/**
 * Admin route-group layout — protects **every** `app/admin/*` page (doc 10
 * FR-31). It `requireAdmin()`s first (redirects to `/admin-login` when there's
 * no valid session), then renders the responsive `AdminShell` around the page.
 *
 * Admin is `noindex,nofollow` (CANON §8) and inherently dynamic: reading the
 * session cookie opts these routes out of static prerendering, so the build
 * never tries to render them at build time.
 */

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · GooglyWoogly Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Authz gate (layer 2 — the real server-side check, doc 10 FR-22).
  const admin = await requireAdmin();

  // Live badge counts + store name for the shell chrome (best-effort).
  const [badges, settings] = await Promise.all([
    getNavBadges().catch(() => ({})),
    getSiteSettings().catch(() => null),
  ]);

  return (
    <AdminShell
      admin={{ name: admin.name, email: admin.email, role: admin.role }}
      storeName={settings?.storeName ?? "GooglyWoogly"}
      badges={badges}
    >
      {children}
    </AdminShell>
  );
}
