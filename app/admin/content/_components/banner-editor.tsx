"use client";

import { BannerType } from "@prisma/client";
import { FormField, AdminInput, AdminSelect } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";
import { BANNER_TYPE_META } from "@/lib/admin/content-shared";
import { ActionForm, useFieldError } from "./action-form";
import { SwitchField } from "./switch-field";
import { upsertBanner } from "../_actions/banners";
import { useEditorSheetClose } from "./editor-sheet";

/**
 * `BannerEditorForm` — the banner editor (doc 15 §4.3). Type (marquee/hero/promo),
 * text, link, optional image id, IST schedule window, sort order, active switch.
 * Posts to `upsertBanner`; the server validates `startsAt ≤ endsAt` and requires
 * marquee text. Times are entered in IST via `datetime-local`.
 */

export interface BannerEditorData {
  id?: string;
  type: BannerType;
  text?: string | null;
  imageId?: string | null;
  link?: string | null;
  startsAtLocal?: string;
  endsAtLocal?: string;
  sortOrder: number;
  isActive: boolean;
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  placeholder,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  const error = useFieldError(name);
  return (
    <FormField label={label} error={error} hint={hint}>
      <AdminInput
        name={name}
        type={type}
        defaultValue={defaultValue == null ? "" : String(defaultValue)}
        placeholder={placeholder}
      />
    </FormField>
  );
}

export function BannerEditorForm({
  data,
  lockedType,
}: {
  data?: BannerEditorData;
  /** When adding from a group header, the type is fixed. */
  lockedType?: BannerType;
}) {
  const close = useEditorSheetClose();
  const type = data?.type ?? lockedType ?? BannerType.marquee;
  const typeError = useFieldError("type");

  return (
    <ActionForm action={upsertBanner} onSuccess={close}>
      {data?.id ? <input type="hidden" name="id" value={data.id} /> : null}

      {lockedType || data?.type ? (
        <input type="hidden" name="type" value={type} />
      ) : (
        <FormField label="Type" error={typeError} required>
          <AdminSelect name="type" defaultValue={type}>
            {Object.values(BannerType).map((t) => (
              <option key={t} value={t}>
                {BANNER_TYPE_META[t].label}
              </option>
            ))}
          </AdminSelect>
        </FormField>
      )}

      <Field
        name="text"
        label="Text"
        defaultValue={data?.text ?? ""}
        placeholder="Free shipping over ₹999 · Handmade in Jaipur"
        hint="Required for the announcement marquee. Light formatting allowed."
      />
      <Field name="link" label="Link" defaultValue={data?.link ?? ""} placeholder="/collections/diwali-gifts" hint="Optional path or https URL." />
      <Field name="imageId" label="Image ID" defaultValue={data?.imageId ?? ""} hint="Optional MediaAsset id (hero/promo)." />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="startsAt" label="Starts (IST)" defaultValue={data?.startsAtLocal ?? ""} type="datetime-local" />
        <Field name="endsAt" label="Ends (IST)" defaultValue={data?.endsAtLocal ?? ""} type="datetime-local" />
      </div>

      <Field name="sortOrder" label="Sort order" defaultValue={data?.sortOrder ?? 0} type="number" />

      <SwitchField name="isActive" label="Active" defaultChecked={data?.isActive ?? true} />

      <div className="flex justify-end gap-2 pt-2">
        <SubmitButton pendingText="Saving…">Save banner</SubmitButton>
      </div>
    </ActionForm>
  );
}
