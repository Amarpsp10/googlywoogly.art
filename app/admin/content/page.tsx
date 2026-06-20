import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { NON_STAFF_ROLES } from "@/lib/auth/types";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { ContentTabs, type ContentTabId } from "./_components/content-tabs";
import { HomepagePanel } from "./_panels/homepage-panel";
import { BannersPanel } from "./_panels/banners-panel";
import { TestimonialsPanel } from "./_panels/testimonials-panel";
import { FaqPanel } from "./_panels/faq-panel";
import { PagesPanel } from "./_panels/pages-panel";

/**
 * `/admin/content` — the tabbed content workspace (doc 15 §4.1, FR-1). SSR,
 * `requireRole(owner|admin)` (content is non-staff, per the admin nav model).
 * The active tab is `?tab=` so the founder can deep-link/bookmark. `noindex`
 * comes from the admin layout (CANON §8).
 */

export const metadata: Metadata = { title: "Content" };

const VALID_TABS: readonly ContentTabId[] = ["homepage", "banners", "testimonials", "faq", "pages"];

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole(NON_STAFF_ROLES);

  const { tab } = await searchParams;
  const active: ContentTabId = VALID_TABS.includes(tab as ContentTabId)
    ? (tab as ContentTabId)
    : "homepage";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Content"
        description="Manage your homepage, banners, testimonials, FAQ, and pages."
        action={
          <Button asChild variant="outline" size="sm" className="min-h-9">
            <Link href="/" target="_blank" rel="noopener">
              View store <ExternalLink className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      <ContentTabs active={active} />

      {active === "homepage" ? <HomepagePanel /> : null}
      {active === "banners" ? <BannersPanel /> : null}
      {active === "testimonials" ? <TestimonialsPanel /> : null}
      {active === "faq" ? <FaqPanel /> : null}
      {active === "pages" ? <PagesPanel /> : null}
    </div>
  );
}
