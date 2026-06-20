"use client";

import * as React from "react";
import type { HomepageSectionType } from "@prisma/client";
import { SECTION_TYPE_META, SECTION_TYPE_OPTIONS } from "@/lib/admin/content-shared";
import { EditorSheet } from "./editor-sheet";
import { SectionEditorForm } from "./section-editor";

/**
 * `AddSection` — the renderer-type picker (doc 15 FR-6 "add from catalogue").
 * Opens a sheet listing the closed `HomepageSectionType` set; choosing one swaps
 * the sheet body to the type-specific editor with sensible defaults. The founder
 * cannot invent new types (FR-5).
 */
export function AddSection() {
  return (
    <EditorSheet
      title="Add a section"
      description="Pick a section type to add to your homepage."
      triggerLabel="Add section"
      triggerIcon="add"
      triggerVariant="default"
    >
      <Picker />
    </EditorSheet>
  );
}

function Picker() {
  const [type, setType] = React.useState<HomepageSectionType | null>(null);

  if (type) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setType(null)}
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Choose a different type
        </button>
        <p className="font-serif text-base font-semibold text-foreground">
          {SECTION_TYPE_META[type].label}
        </p>
        <SectionEditorForm type={type} />
      </div>
    );
  }

  return (
    <ul className="grid gap-2 pt-2 sm:grid-cols-2">
      {SECTION_TYPE_OPTIONS.map((t) => (
        <li key={t}>
          <button
            type="button"
            onClick={() => setType(t)}
            className="flex w-full flex-col items-start gap-0.5 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary hover:bg-pastel-pink/10"
          >
            <span className="text-sm font-semibold text-foreground">
              {SECTION_TYPE_META[t].label}
            </span>
            <span className="text-xs text-muted-foreground">
              {SECTION_TYPE_META[t].description}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
