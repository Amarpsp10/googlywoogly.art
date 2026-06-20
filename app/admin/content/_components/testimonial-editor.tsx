"use client";

import { FormField, AdminInput, AdminTextarea, AdminSelect } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";
import { ActionForm, useFieldError } from "./action-form";
import { upsertTestimonial } from "../_actions/testimonials";
import { useEditorSheetClose } from "./editor-sheet";

/**
 * `TestimonialEditorForm` — add/edit a testimonial (doc 15 §4.4). Name, location,
 * rating (1–5), quote, optional image id. New entries default unapproved; approve
 * and feature are separate one-tap actions in the list.
 */

export interface TestimonialEditorData {
  id?: string;
  customerName: string;
  location?: string | null;
  rating?: number | null;
  text: string;
  imageId?: string | null;
  sortOrder: number;
}

export function TestimonialEditorForm({
  data,
}: {
  data?: TestimonialEditorData;
}) {
  const close = useEditorSheetClose();
  const nameError = useFieldError("customerName");
  const textError = useFieldError("text");
  const ratingError = useFieldError("rating");

  return (
    <ActionForm action={upsertTestimonial} onSuccess={close}>
      {data?.id ? <input type="hidden" name="id" value={data.id} /> : null}

      <FormField label="Customer name" required error={nameError}>
        <AdminInput name="customerName" defaultValue={data?.customerName ?? ""} required placeholder="Aarti S." />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Location">
          <AdminInput name="location" defaultValue={data?.location ?? ""} placeholder="Jaipur" />
        </FormField>
        <FormField label="Rating" error={ratingError}>
          <AdminSelect name="rating" defaultValue={data?.rating ? String(data.rating) : ""} placeholder="No rating">
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {"★".repeat(r)} ({r})
              </option>
            ))}
          </AdminSelect>
        </FormField>
      </div>

      <FormField label="Quote" required error={textError}>
        <AdminTextarea
          name="text"
          rows={4}
          defaultValue={data?.text ?? ""}
          required
          maxLength={1000}
          placeholder="Loved the hand-painted mug — even better in person!"
        />
      </FormField>

      <FormField label="Photo ID" hint="Optional MediaAsset id (customer or product photo).">
        <AdminInput name="imageId" defaultValue={data?.imageId ?? ""} />
      </FormField>

      <input type="hidden" name="sortOrder" value={data?.sortOrder ?? 0} />

      <div className="flex justify-end gap-2 pt-2">
        <SubmitButton pendingText="Saving…">Save testimonial</SubmitButton>
      </div>
    </ActionForm>
  );
}
