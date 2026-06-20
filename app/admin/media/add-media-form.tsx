"use client";

import { FormField, AdminInput, AdminSelect } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";
import { MediaType } from "@prisma/client";
import {
  ActionForm,
  useFieldError,
} from "../content/_components/action-form";
import { useEditorSheetClose } from "../content/_components/editor-sheet";
import { addMedia } from "./actions";

/**
 * `AddMediaForm` — register a media asset by URL (doc 15 §5.2 MVP; the full
 * upload library is docs/11). Posts to `addMedia`; closes its sheet on success.
 */
export function AddMediaForm() {
  const close = useEditorSheetClose();
  const urlError = useFieldError("url");

  return (
    <ActionForm action={addMedia} onSuccess={close}>
      <FormField label="Image URL" required error={urlError} hint="Paste a public https image URL.">
        <AdminInput name="url" type="url" required placeholder="https://res.cloudinary.com/…/image.jpg" />
      </FormField>

      <FormField label="Alt text" hint="Describe the image for accessibility and SEO.">
        <AdminInput name="alt" maxLength={200} placeholder="Hand-painted blue pottery mug" />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Type">
          <AdminSelect name="type" defaultValue={MediaType.image}>
            {Object.values(MediaType).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </AdminSelect>
        </FormField>
        <FormField label="Width">
          <AdminInput name="width" type="number" min={0} placeholder="900" />
        </FormField>
        <FormField label="Height">
          <AdminInput name="height" type="number" min={0} placeholder="900" />
        </FormField>
      </div>

      <FormField label="Folder" hint="Optional grouping (e.g. banners, products).">
        <AdminInput name="folder" maxLength={80} placeholder="banners" />
      </FormField>

      <div className="flex justify-end gap-2 pt-2">
        <SubmitButton pendingText="Adding…">Add media</SubmitButton>
      </div>
    </ActionForm>
  );
}
