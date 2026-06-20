import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { NON_STAFF_ROLES } from "@/lib/auth/types";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CategoryForm, type CategoryFormValues, type ParentOption } from "../../category-form";

/**
 * Edit-category page (docs/11 §4.5). Owner/admin only. The parent select offers
 * top-level categories **excluding this one**; if this category itself has
 * children the select is locked (a parent can't become a child — FR-57).
 */

export const metadata: Metadata = { title: "Edit category" };
export const dynamic = "force-dynamic";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(NON_STAFF_ROLES);
  const { id } = await params;

  const category = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageId: true,
      parentId: true,
      sortOrder: true,
      isActive: true,
      metaTitle: true,
      metaDescription: true,
      _count: { select: { children: true } },
    },
  });
  if (!category) notFound();

  // Candidate parents: top-level, not this category itself.
  const parents = await prisma.category.findMany({
    where: { parentId: null, NOT: { id } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  const parentOptions: ParentOption[] = parents;

  const initial: CategoryFormValues = {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description ?? "",
    imageId: category.imageId ?? "",
    parentId: category.parentId ?? "",
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    metaTitle: category.metaTitle ?? "",
    metaDescription: category.metaDescription ?? "",
  };

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
          title={`Edit ${category.name}`}
          description="Changing the web address keeps the old link working with a redirect."
        />
      </div>

      <CategoryForm
        initial={initial}
        parentOptions={parentOptions}
        parentLocked={category._count.children > 0}
      />
    </div>
  );
}
