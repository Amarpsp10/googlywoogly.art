"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/admin/audit";
import { ok, fail, failValidation, type ActionResult } from "@/lib/result";
import { updateCustomerCrmSchema } from "@/lib/validations/crm";

/**
 * Customer CRM mutation (doc 12 §5.2). Writes **only** the founder-editable CRM
 * fields — `tags` and `notes`. The `Customer` row's counters (`ordersCount`,
 * `totalRequested`, `firstOrderAt`, `lastOrderAt`) are owned by order placement
 * and are deliberately NOT writable here.
 *
 * Tags arrive as a comma-separated string from the form's hidden field and are
 * normalised (trim / de-dupe / cap) by the schema. Every admin action:
 * `requireAdmin()` → Zod-validate → write → `writeAudit()` → revalidate →
 * return `ActionResult`. No storefront cache tags (internal CRM surface).
 */
export async function updateCustomerCrm(
  _prev: ActionResult<void> | undefined,
  formData: FormData,
): Promise<ActionResult<void>> {
  const admin = await requireAdmin();

  const parsed = updateCustomerCrmSchema.safeParse({
    id: formData.get("id"),
    tags: formData.get("tags") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const { id, tags, notes } = parsed.data;

  const before = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, tags: true, notes: true },
  });
  if (!before) return fail("That customer no longer exists.");

  const updated = await prisma.customer.update({
    where: { id },
    data: { tags, notes },
    select: { id: true, tags: true, notes: true },
  });

  await writeAudit({
    adminId: admin.id,
    action: "customer.update",
    entityType: "Customer",
    entityId: id,
    before,
    after: updated,
  });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${id}`);
  return ok(undefined);
}
