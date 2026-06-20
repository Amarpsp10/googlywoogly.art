import { HelpCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/admin/panel";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { richTextToPlain } from "@/lib/admin/sanitize-html";
import { EditorSheet } from "../_components/editor-sheet";
import { FaqEditorForm } from "../_components/faq-editor";
import { QuickToggle } from "../_components/quick-toggle";
import { ReorderControls } from "../_components/reorder-controls";
import { SeedButton } from "../_components/seed-button";
import {
  toggleFaqItem,
  reorderFaqItems,
  deleteFaqItem,
  seedRecommendedFaqs,
} from "../_actions/faq";

/**
 * FAQ tab (doc 15 §4.5) — grouped by category, items reorderable within a group.
 * Publish toggle, edit, delete; "Seed recommended FAQs" when empty (FR-17).
 */
export async function FaqPanel() {
  const items = await prisma.faqItem.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      question: true,
      answer: true,
      category: true,
      sortOrder: true,
      isPublished: true,
    },
  });

  // Group by category (Uncategorised → "General", last).
  const groupsMap = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.category?.trim() || "General";
    const arr = groupsMap.get(key) ?? [];
    arr.push(item);
    groupsMap.set(key, arr);
  }
  const groups = [...groupsMap.entries()].sort(([a], [b]) =>
    a === "General" ? 1 : b === "General" ? -1 : a.localeCompare(b),
  );
  const categories = [...new Set(items.map((i) => i.category?.trim()).filter(Boolean) as string[])];

  return (
    <Panel
      title="FAQ"
      description="Answer common questions to deflect repeat messages."
      action={
        <EditorSheet title="Add FAQ" triggerLabel="Add FAQ" triggerIcon="add" triggerVariant="default">
          <FaqEditorForm categories={categories} />
        </EditorSheet>
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon={<HelpCircle className="size-6" />}
          title="No FAQs yet"
          description="Seed a recommended set, or add your own questions."
          action={<SeedButton action={seedRecommendedFaqs} label="Seed recommended FAQs" />}
        />
      ) : (
        <div className="space-y-5">
          {groups.map(([category, groupItems]) => {
            const ids = groupItems.map((i) => i.id);
            return (
              <section key={category}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </h3>
                <ul className="space-y-2">
                  {groupItems.map((item, index) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border p-3"
                    >
                      <ReorderControls ids={ids} index={index} action={reorderFaqItems} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{item.question}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {richTextToPlain(item.answer)}
                        </p>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        {!item.isPublished ? <StatusBadge tone="neutral" label="Draft" /> : null}
                        <QuickToggle
                          id={item.id}
                          checked={item.isPublished}
                          action={toggleFaqItem}
                          label={item.isPublished ? "Live" : "Draft"}
                        />
                        <EditorSheet title="Edit FAQ" triggerLabel="Edit" triggerIcon="edit">
                          <FaqEditorForm
                            categories={categories}
                            data={{
                              id: item.id,
                              question: item.question,
                              answer: item.answer,
                              category: item.category,
                              sortOrder: item.sortOrder,
                              isPublished: item.isPublished,
                            }}
                          />
                        </EditorSheet>
                        <ConfirmButton
                          action={deleteFaqItem}
                          hiddenFields={{ id: item.id }}
                          title="Delete this FAQ?"
                          confirmLabel="Delete"
                          size="icon-sm"
                          aria-label="Delete FAQ"
                        >
                          ✕
                        </ConfirmButton>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
