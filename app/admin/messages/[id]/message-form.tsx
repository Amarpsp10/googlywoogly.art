"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { ContactStatus } from "@prisma/client";
import { updateContactMessage } from "../actions";
import { CONTACT_STATUS } from "@/lib/constants";
import type { ActionResult } from "@/lib/result";
import { FormField, AdminSelect } from "@/components/admin/form-field";
import { SubmitButton } from "@/components/admin/submit-button";

/**
 * Contact-message status form (client leaf). Posts `updateContactMessage` via
 * `useActionState`; surfaces the `ActionResult` as a toast. The reply itself is
 * sent from the founder's mail client (a `mailto:` link on the detail) — here we
 * just record the resulting status.
 */

const STATUS_OPTIONS = Object.entries(ContactStatus).map(([value]) => ({
  value,
  label: CONTACT_STATUS[value as ContactStatus].label,
}));

const initial: ActionResult<void> = { ok: false, error: "" };

export function MessageForm({
  id,
  status,
}: {
  id: string;
  status: ContactStatus;
}) {
  const [state, action] = useActionState(updateContactMessage, initial);
  const fieldErrors = !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state.ok) toast.success("Message updated.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />

      <FormField label="Status" error={fieldErrors?.status?.[0]}>
        <AdminSelect name="status" defaultValue={status} options={STATUS_OPTIONS} />
      </FormField>

      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…">Save status</SubmitButton>
      </div>
    </form>
  );
}
