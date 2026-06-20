"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { InquiryStatus } from "@prisma/client";
import { updateBulkInquiry } from "../actions";
import { INQUIRY_STATUS } from "@/lib/constants";
import type { ActionResult } from "@/lib/result";
import { FormField, AdminSelect, AdminTextarea } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";

/**
 * Inquiry pipeline form (client leaf). Posts `updateBulkInquiry` via
 * `useActionState`; surfaces the `ActionResult` as a toast and renders any
 * field errors inline. Status (pipeline), assignee, and internal notes are
 * edited together and saved in one action.
 */

const STATUS_OPTIONS = Object.entries(InquiryStatus).map(([value]) => ({
  value,
  label: INQUIRY_STATUS[value as InquiryStatus].label,
}));

const initial: ActionResult<void> = { ok: false, error: "" };

export function InquiryForm({
  id,
  status,
  assignedToAdminId,
  internalNotes,
  admins,
}: {
  id: string;
  status: InquiryStatus;
  assignedToAdminId: string | null;
  internalNotes: string | null;
  admins: readonly { id: string; name: string }[];
}) {
  const [state, action] = useActionState(updateBulkInquiry, initial);
  const fieldErrors = !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state.ok) toast.success("Inquiry updated.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />

      <FormField label="Pipeline status" error={fieldErrors?.status?.[0]}>
        <AdminSelect name="status" defaultValue={status} options={STATUS_OPTIONS} />
      </FormField>

      <FormField
        label="Assigned to"
        hint="Who is following up on this lead."
        error={fieldErrors?.assignedToAdminId?.[0]}
      >
        <AdminSelect name="assignedToAdminId" defaultValue={assignedToAdminId ?? ""}>
          <option value="">Unassigned</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </AdminSelect>
      </FormField>

      <FormField
        label="Internal notes"
        hint="Private — never shown to the customer."
        error={fieldErrors?.internalNotes?.[0]}
      >
        <AdminTextarea
          name="internalNotes"
          defaultValue={internalNotes ?? ""}
          rows={5}
          placeholder="Call notes, quote details, next steps…"
        />
      </FormField>

      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}
