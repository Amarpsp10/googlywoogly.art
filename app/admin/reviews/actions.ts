"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/admin/audit";
import { revalidateProduct } from "@/lib/revalidate";
import { ok, fail, failValidation, type ActionResult } from "@/lib/result";
import { moderateReviewSchema } from "@/lib/validations/crm";

/**
 * Product-review moderation (V1, doc 10 FR-45 `review.moderate`). Approve or
 * reject a pending review.
 *
 * Reviews are an **owner/admin** surface (doc 10 §5.4 — `staff` ⛔), so this
 * action gates with `requireRole(["owner", "admin"])`, not bare `requireAdmin`.
 * On a decision: gate → Zod-validate → write → `writeAudit()` → revalidate the
 * affected `product:{slug}` (an approval/rejection changes what renders on the
 * PDP) and the admin route → return `ActionResult`.
 */
export async function moderateReview(
  _prev: ActionResult<void> | undefined,
  formData: FormData,
): Promise<ActionResult<void>> {
  const admin = await requireRole(["owner", "admin"]);

  const parsed = moderateReviewSchema.safeParse({
    id: formData.get("id"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) {
    return failValidation(parsed.error.flatten().fieldErrors);
  }
  const { id, decision } = parsed.data;

  const before = await prisma.review.findUnique({
    where: { id },
    select: { id: true, status: true, product: { select: { slug: true } } },
  });
  if (!before) return fail("That review no longer exists.");

  const updated = await prisma.review.update({
    where: { id },
    data: { status: decision, approvedByAdminId: admin.id },
    select: { id: true, status: true },
  });

  await writeAudit({
    adminId: admin.id,
    action: "review.moderate",
    entityType: "Review",
    entityId: id,
    before: { status: before.status },
    after: { status: updated.status },
  });

  // The PDP review block depends on approved reviews for this product.
  revalidateProduct(before.product.slug);
  revalidatePath("/admin/reviews");
  return ok(undefined);
}
