import Link from "next/link";
import type { Metadata } from "next";
import { FolderTree, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { NON_STAFF_ROLES } from "@/lib/auth/types";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { CategoryTree, type CategoryNode } from "./category-tree";
import type { ReassignOption } from "./category-row-actions";

/**
 * Category management list (docs/11 §3.14 / §4.5). Owner/admin only — `staff`
 * is barred from taxonomy (docs/11 §1.3). Renders the one-level tree with live
 * product counts and an active/hidden badge per row, plus keyboard-accessible
 * reordering. Reads `Category` directly (admin sees inactive categories too).
 */

export const metadata: Metadata = { title: "Categories" };

// Reading the session cookie already opts this route out of static rendering;
// declaring it keeps the intent explicit (admin is always dynamic).
export const dynamic = "force-dynamic";

interface RawCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  _count: { products: number };
}

/** Build the parent→child tree (one level) from a flat, pre-sorted list. */
function buildTree(rows: RawCategory[]): CategoryNode[] {
  const toNode = (r: RawCategory, children: CategoryNode[] = []): CategoryNode => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    isActive: r.isActive,
    productCount: r._count.products,
    children,
  });

  const parents = rows.filter((r) => !r.parentId);
  const childrenByParent = new Map<string, RawCategory[]>();
  for (const r of rows) {
    if (r.parentId) {
      const list = childrenByParent.get(r.parentId) ?? [];
      list.push(r);
      childrenByParent.set(r.parentId, list);
    }
  }

  return parents.map((p) =>
    toNode(
      p,
      (childrenByParent.get(p.id) ?? []).map((c) => toNode(c)),
    ),
  );
}

export default async function AdminCategoriesPage() {
  await requireRole(NON_STAFF_ROLES);

  const rows = (await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      isActive: true,
      sortOrder: true,
      _count: { select: { products: true } },
    },
  })) satisfies RawCategory[];

  const tree = buildTree(rows);
  // Any category can receive reassigned products on delete.
  const reassignOptions: ReassignOption[] = rows.map((r) => ({ id: r.id, name: r.name }));

  const newButton = (
    <Button asChild className="min-h-11 rounded-full">
      <Link href="/admin/categories/new">
        <Plus className="size-4" aria-hidden />
        New category
      </Link>
    </Button>
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Categories"
        description="Organize products by what they are. Drag the arrows to reorder; indent shows one-level children."
        action={newButton}
      />

      {tree.length === 0 ? (
        <EmptyState
          icon={<FolderTree className="size-6" />}
          title="No categories yet"
          description="Create your first category to start organizing the catalog (e.g. “Diyas & Candles”)."
          action={newButton}
        />
      ) : (
        <Panel bodyClassName="px-3 py-3 sm:px-4">
          <CategoryTree categories={tree} reassignOptions={reassignOptions} />
        </Panel>
      )}
    </div>
  );
}
