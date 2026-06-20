import { Copy } from "lucide-react";
import { BannerType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/admin/panel";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { formatDateTimeIST } from "@/lib/format";
import {
  bannerStatus,
  BANNER_STATUS_META,
  BANNER_TYPE_META,
  dateToISTLocalInput,
} from "@/lib/admin/content-shared";
import { richTextToPlain } from "@/lib/admin/sanitize-html";
import { EditorSheet } from "../_components/editor-sheet";
import { BannerEditorForm } from "../_components/banner-editor";
import { QuickToggle } from "../_components/quick-toggle";
import { ActionButton } from "../_components/action-button";
import { toggleBanner, deleteBanner, duplicateBanner } from "../_actions/banners";

/**
 * Banners tab (doc 15 §4.3). Grouped by type with computed status chips
 * (Live/Scheduled/Expired/Off) and a precedence hint for the marquee fallback.
 */
export async function BannersPanel() {
  const banners = await prisma.banner.findMany({
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      type: true,
      text: true,
      imageId: true,
      link: true,
      startsAt: true,
      endsAt: true,
      sortOrder: true,
      isActive: true,
    },
  });

  const now = new Date();
  const groups: { type: BannerType; rows: typeof banners }[] = [
    { type: BannerType.marquee, rows: banners.filter((b) => b.type === BannerType.marquee) },
    { type: BannerType.hero, rows: banners.filter((b) => b.type === BannerType.hero) },
    { type: BannerType.promo, rows: banners.filter((b) => b.type === BannerType.promo) },
  ];

  const anyMarqueeLive = banners.some(
    (b) => b.type === BannerType.marquee && bannerStatus(b, now) === "live",
  );

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Panel
          key={group.type}
          title={BANNER_TYPE_META[group.type].label}
          description={BANNER_TYPE_META[group.type].description}
          action={
            <EditorSheet
              title={`New ${BANNER_TYPE_META[group.type].label.toLowerCase()}`}
              triggerLabel="New"
              triggerIcon="add"
            >
              <BannerEditorForm lockedType={group.type} />
            </EditorSheet>
          }
        >
          {group.rows.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No banners yet.</p>
          ) : (
            <ul className="space-y-2">
              {group.rows.map((banner) => {
                const status = bannerStatus(banner, now);
                const statusMeta = BANNER_STATUS_META[status];
                const preview = banner.text ? richTextToPlain(banner.text) : "(image banner)";
                return (
                  <li
                    key={banner.id}
                    className={`flex flex-col gap-2 rounded-2xl border border-border p-3 sm:flex-row sm:items-center ${
                      status === "expired" ? "opacity-60" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{preview}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {banner.startsAt || banner.endsAt
                          ? `${banner.startsAt ? formatDateTimeIST(banner.startsAt) : "—"} → ${
                              banner.endsAt ? formatDateTimeIST(banner.endsAt) : "—"
                            }`
                          : "No schedule"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={statusMeta.tone} label={statusMeta.label} />
                      <QuickToggle
                        id={banner.id}
                        checked={banner.isActive}
                        action={toggleBanner}
                        label={banner.isActive ? "On" : "Off"}
                      />
                      <EditorSheet
                        title={`Edit ${BANNER_TYPE_META[banner.type].label.toLowerCase()}`}
                        triggerLabel="Edit"
                        triggerIcon="edit"
                      >
                        <BannerEditorForm
                          data={{
                            id: banner.id,
                            type: banner.type,
                            text: banner.text,
                            imageId: banner.imageId,
                            link: banner.link,
                            startsAtLocal: dateToISTLocalInput(banner.startsAt),
                            endsAtLocal: dateToISTLocalInput(banner.endsAt),
                            sortOrder: banner.sortOrder,
                            isActive: banner.isActive,
                          }}
                        />
                      </EditorSheet>
                      <ActionButton
                        action={duplicateBanner.bind(null, banner.id)}
                        successMessage="Duplicated — reschedule the copy."
                        icon={<Copy className="size-4" />}
                        aria-label="Duplicate banner"
                        size="icon-sm"
                      />
                      <ConfirmButton
                        action={deleteBanner}
                        hiddenFields={{ id: banner.id }}
                        title="Delete this banner?"
                        confirmLabel="Delete"
                        size="icon-sm"
                        aria-label="Delete banner"
                      >
                        ✕
                      </ConfirmButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {group.type === BannerType.marquee && !anyMarqueeLive ? (
            <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              No marquee is live, so the header shows your Announcement Bar text from
              Settings.
            </p>
          ) : null}
        </Panel>
      ))}
    </div>
  );
}
