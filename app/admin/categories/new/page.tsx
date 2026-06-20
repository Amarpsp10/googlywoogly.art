import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { NON_STAFF_ROLES } from "@/lib/auth/types";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CategoryForm, type CategoryFormValues, type ParentOption } from "../category-form";

/**
 * Create-category page (docs/11 §4.5). Owner/admin only. Offers only **top-level**
 * categories as parent options (depth = 1, FR-57). Saving goes through
 * `upsertCategory` and returns to the list.
 */

export const metadata: Metadata = { title: "New category" };
export const dynamic = "force-dynamic";

const EMPTY: CategoryFormValues = {
  name: "",
  slug: "",
  description: "",
  imageId: "",
  parentId: "",
  sortOrder: 0,
  isActive: true,
  metaTitle: "",
  metaDescription: "",
};

export default async function NewCategoryPage() {
  await requireRole(NON_STAFF_ROLES);

  // Only top-level categories may be parents (one-level nesting).
  const parents = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  const parentOptions: ParentOption[] = parents;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/admin/categories"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to categories
        </Link>
        <AdminPageHeader
          title="New category"
          description="Give it a name — everything else is optional and can be edited later."
        />
      </div>

      <CategoryForm initial={EMPTY} parentOptions={parentOptions} />
    </div>
  );
}
