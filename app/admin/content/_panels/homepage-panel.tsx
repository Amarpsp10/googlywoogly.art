import { LayoutTemplate } from "lucide-react";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/admin/panel";
import { Toolbar } from "@/components/admin/toolbar";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmButton } from "@/components/admin/confirm-button";
import {
  SECTION_TYPE_META,
  summarizeSectionPayload,
} from "@/lib/admin/content-shared";
import { EditorSheet } from "../_components/editor-sheet";
import { SectionEditorForm } from "../_components/section-editor";
import { AddSection } from "../_components/add-section";
import { QuickToggle } from "../_components/quick-toggle";
import { ReorderControls } from "../_components/reorder-controls";
import { SeedButton } from "../_components/seed-button";
import {
  toggleHomepageSection,
  reorderHomepageSections,
  deleteHomepageSection,
  seedDefaultHomepage,
} from "../_actions/homepage";

/**
 * Homepage tab (doc 15 §4.2). RSC: reads ALL sections (incl. hidden) ordered by
 * `sortOrder`, renders a reorderable list with per-row toggle/edit/delete. Empty
 * state offers "Seed default homepage" (FR-8).
 */
export async function HomepagePanel() {
  const sections = await prisma.homepageSection.findMany({
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    select: {
      id: true,
      key: true,
      type: true,
      payload: true,
      sortOrder: true,
      isActive: true,
      updatedAt: true,
    },
  });

  const ids = sections.map((s) => s.id);

  return (
    <Panel
      title="Homepage sections"
      description="Reorder, hide, or edit each block. Changes go live in seconds."
      action={<AddSection />}
    >
      {sections.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate className="size-6" />}
          title="Your homepage uses the default layout"
          description="Materialise the default sections as editable rows to customise them."
          action={<SeedButton action={seedDefaultHomepage} label="Seed default homepage" />}
        />
      ) : (
        <ul className="space-y-2">
          {sections.map((section, index) => {
            const meta = SECTION_TYPE_META[section.type];
            return (
              <li
                key={section.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-card p-3"
              >
                <ReorderControls ids={ids} index={index} action={reorderHomepageSections} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{meta.label}</span>
                    {!section.isActive ? (
                      <StatusBadge tone="neutral" label="Hidden" />
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {summarizeSectionPayload(section.type, section.payload)}
                  </p>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <QuickToggle
                    id={section.id}
                    checked={section.isActive}
                    action={toggleHomepageSection}
                    label={section.isActive ? "Live" : "Hidden"}
                  />

                  <EditorSheet title={`Edit ${meta.label}`} triggerLabel="Edit" triggerIcon="edit">
                    <SectionEditorForm
                      type={section.type}
                      data={{
                        id: section.id,
                        isActive: section.isActive,
                        expectedUpdatedAt: section.updatedAt.toISOString(),
                        payload: (section.payload ?? {}) as Record<string, unknown>,
                      }}
                    />
                  </EditorSheet>

                  <ConfirmButton
                    action={deleteHomepageSection}
                    hiddenFields={{ id: section.id }}
                    title="Delete this section?"
                    description="It will be removed from your homepage. This can't be undone."
                    confirmLabel="Delete"
                    size="icon-sm"
                    aria-label="Delete section"
                  >
                    ✕
                  </ConfirmButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {sections.length > 0 ? (
        <Toolbar className="mt-4 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            {sections.filter((s) => s.isActive).length} live ·{" "}
            {sections.length} total sections
          </p>
        </Toolbar>
      ) : null}
    </Panel>
  );
}
