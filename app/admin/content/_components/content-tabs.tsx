import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * `ContentTabs` — the `?tab=`-driven segmented control for the content workspace
 * (doc 15 FR-1). RSC: renders real links (navigable without JS) that preserve
 * deep-linking/bookmarking; horizontally scrollable on mobile (FR-1). The active
 * tab is derived from the current `tab` value passed by the page.
 */

export const CONTENT_TABS = [
  { id: "homepage", label: "Homepage", href: "/admin/content" },
  { id: "banners", label: "Banners", href: "/admin/content?tab=banners" },
  { id: "testimonials", label: "Testimonials", href: "/admin/content?tab=testimonials" },
  { id: "faq", label: "FAQ", href: "/admin/content?tab=faq" },
  { id: "pages", label: "Pages", href: "/admin/content?tab=pages" },
] as const;

export type ContentTabId = (typeof CONTENT_TABS)[number]["id"];

export function ContentTabs({ active }: { active: ContentTabId }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <nav
        aria-label="Content sections"
        className="inline-flex min-w-full gap-1 rounded-full bg-muted p-1"
      >
        {CONTENT_TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
