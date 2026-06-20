"use client";

import { FormField, AdminInput } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";
import { ActionForm, useFieldError } from "./action-form";
import { RichTextField } from "./rich-text-field";
import { SwitchField } from "./switch-field";
import { upsertFaqItem } from "../_actions/faq";
import { useEditorSheetClose } from "./editor-sheet";

/**
 * `FaqEditorForm` — author a FAQ entry (doc 15 §4.5). Question, rich answer
 * (sanitized server-side), free-text category (with datalist of existing ones),
 * sort order, publish switch.
 */

export interface FaqEditorData {
  id?: string;
  question: string;
  answer: string;
  category?: string | null;
  sortOrder: number;
  isPublished: boolean;
}

export function FaqEditorForm({
  data,
  categories,
}: {
  data?: FaqEditorData;
  /** Existing category names for the combobox datalist. */
  categories: string[];
}) {
  const close = useEditorSheetClose();
  const questionError = useFieldError("question");

  return (
    <ActionForm action={upsertFaqItem} onSuccess={close}>
      {data?.id ? <input type="hidden" name="id" value={data.id} /> : null}

      <FormField label="Question" required error={questionError}>
        <AdminInput
          name="question"
          defaultValue={data?.question ?? ""}
          required
          maxLength={200}
          placeholder="How long until my order ships?"
        />
      </FormField>

      <RichTextField
        name="answer"
        label="Answer"
        defaultValue={data?.answer ?? ""}
        required
        rows={8}
        maxLength={4000}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Category" hint="Group similar questions (e.g. Orders & Shipping).">
          <AdminInput
            name="category"
            defaultValue={data?.category ?? ""}
            list="faq-categories"
            placeholder="Orders & Shipping"
          />
          <datalist id="faq-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </FormField>
        <FormField label="Sort order">
          <AdminInput name="sortOrder" type="number" defaultValue={data?.sortOrder ?? 0} />
        </FormField>
      </div>

      <SwitchField name="isPublished" label="Published" defaultChecked={data?.isPublished ?? true} />

      <div className="flex justify-end gap-2 pt-2">
        <SubmitButton pendingText="Saving…">Save FAQ</SubmitButton>
      </div>
    </ActionForm>
  );
}
