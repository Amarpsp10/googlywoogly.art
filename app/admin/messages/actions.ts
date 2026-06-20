"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/admin/audit";
import { ok, fail, failValidation, type ActionResult } from "@/lib/result";
import { updateContactMessageSchema } from "@/lib/validations/crm";

/**
 * Contact-message CRM mutation (doc 12 leads). Records the message's status
 * (new → read → replied → archived); the actual reply is sent from the
 * founder's mail client via a `mailto:` link on the detail. Every admin action:
 * `requireAdmin()` → Zod-validate → write → `writeAudit()` → revalidate →
 * return `ActionResult`. No storefront cache tags (internal CRM surface).
 */
export async function updateContactMessage(
  _prev: ActionResult<void> | undefined,
  formData: FormData,
): Promise<ActionResult<void>> {
  const admin = await requireAdmin();

  const parsed = updateContactMessageSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const { id, status } = parsed.data;

  const before = await prisma.contactMessage.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!before) return fail("That message no longer exists.");

  const updated = await prisma.contactMessage.update({
    where: { id },
    data: { status },
    select: { id: true, status: true },
  });

  await writeAudit({
    adminId: admin.id,
    action: "contact_message.update",
    entityType: "ContactMessage",
    entityId: id,
    before,
    after: updated,
  });

  revalidatePath("/admin/messages");
  revalidatePath(`/admin/messages/${id}`);
  return ok(undefined);
}
