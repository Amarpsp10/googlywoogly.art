import Link from "next/link";
import type { Metadata } from "next";
import { Layers, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { NON_STAFF_ROLES } from "@/lib/auth/types";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { CollectionList, type CollectionListRow } from "./collection-list";

/**
 * Collection management list (docs/11 §3.15 / §4.6). Owner/admin only. Shows each
 * collection with type, ★home, active state, and live member count, plus
 * keyboard-accessible reordering. Reads `Collection` directly (admin sees hidden
 * collections too).
 */

export const metadata: Metadata = { title: "Collections" };
export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage() {
  await requireRole(NON_STAFF_ROLES);

  const rows = await prisma.collection.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      type: true,
      isActive: true,
      isFeaturedOnHome: true,
      _count: { select: { products: true } },
    },
  });

  const collections: CollectionListRow[] = rows.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    type: c.type,
    isActive: c.isActive,
    isFeaturedOnHome: c.isFeaturedOnHome,
    memberCount: c._count.products,
  }));

  const newButton = (
    <Button asChild className="min-h-11 rounded-full">
      <Link href="/admin/collections/new">
        <Plus className="size-4" aria-hidden />
        New collection
      </Link>
    </Button>
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Collections"
        description="Merchandise products into themed groups like “Diwali Gifts”. Reorder with the arrows."
        action={newButton}
      />

      {collections.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-6" />}
          title="No collections yet"
          description="Create a collection to group products for a campaign, occasion, or the homepage."
          action={newButton}
        />
      ) : (
        <Panel bodyClassName="px-3 py-3 sm:px-4">
          <CollectionList collections={collections} />
        </Panel>
      )}
    </div>
  );
}
