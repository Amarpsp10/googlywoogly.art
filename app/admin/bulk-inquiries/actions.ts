"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/admin/audit";
import { ok, fail, failValidation, type ActionResult } from "@/lib/result";
import { updateBulkInquirySchema } from "@/lib/validations/crm";
import { revalidatePath } from "next/cache";

/**
 * Bulk-inquiry CRM mutation (doc 12 leads). Pipeline status + assignee +
 * internal notes. Every admin action: `requireAdmin()` → Zod-validate → write →
 * `writeAudit()` → revalidate → return `ActionResult`.
 *
 * No storefront cache tags are touched (bulk inquiries are an internal CRM
 * surface, not catalog/content) — only the admin route is revalidated so the
 * list/detail reflect the change immediately.
 */
export async function updateBulkInquiry(
  _prev: ActionResult<void> | undefined,
  formData: FormData,
): Promise<ActionResult<void>> {
  const admin = await requireAdmin();

  const parsed = updateBulkInquirySchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    assignedToAdminId: formData.get("assignedToAdminId") ?? undefined,
    internalNotes: formData.get("internalNotes") ?? undefined,
  });
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const { id, status, assignedToAdminId, internalNotes } = parsed.data;

  // Load the current row for the audit `before` snapshot + existence check.
  const before = await prisma.bulkInquiry.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      assignedToAdminId: true,
      internalNotes: true,
    },
  });
  if (!before) return fail("That inquiry no longer exists.");

  // Validate the assignee references a real, active admin (defence in depth —
  // the select only offers active admins, but a forged post must be rejected).
  if (assignedToAdminId) {
    const assignee = await prisma.adminUser.findFirst({
      where: { id: assignedToAdminId, isActive: true },
      select: { id: true },
    });
    if (!assignee) {
      return failValidation({ assignedToAdminId: ["Pick a current team member."] });
    }
  }

  const updated = await prisma.bulkInquiry.update({
    where: { id },
    data: {
      status,
      assignedToAdminId,
      internalNotes: internalNotes ?? null,
    },
    select: {
      id: true,
      status: true,
      assignedToAdminId: true,
      internalNotes: true,
    },
  });

  await writeAudit({
    adminId: admin.id,
    action: "bulk_inquiry.update",
    entityType: "BulkInquiry",
    entityId: id,
    before,
    after: updated,
  });

  revalidatePath("/admin/bulk-inquiries");
  revalidatePath(`/admin/bulk-inquiries/${id}`);
  return ok(undefined);
}
