import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CollectionType } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { NON_STAFF_ROLES } from "@/lib/auth/types";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CollectionForm, type CollectionFormValues } from "../collection-form";

/**
 * Create-collection page (docs/11 §4.6). Owner/admin only. Captures Details;
 * after creating, the founder is taken to the editor to add members (manual) or
 * tune rules (automated).
 */

export const metadata: Metadata = { title: "New collection" };
export const dynamic = "force-dynamic";

const EMPTY: CollectionFormValues = {
  title: "",
  slug: "",
  description: "",
  heroImageId: "",
  heroImageUrl: "",
  type: CollectionType.manual,
  rules: { match: "all", conditions: [] },
  sortOrder: 0,
  isActive: true,
  isFeaturedOnHome: false,
  metaTitle: "",
  metaDescription: "",
};

export default async function NewCollectionPage() {
  await requireRole(NON_STAFF_ROLES);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/admin/collections"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to collections
        </Link>
        <AdminPageHeader
          title="New collection"
          description="Give it a title — you'll add products after saving."
        />
      </div>

      <CollectionForm initial={EMPTY} />
    </div>
  );
}
