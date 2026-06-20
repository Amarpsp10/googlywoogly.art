import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { CollectionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { NON_STAFF_ROLES } from "@/lib/auth/types";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { formatPaise } from "@/lib/money";
import { CollectionForm, type CollectionFormValues } from "../../collection-form";
import { CollectionMembers, type CollectionMember } from "../../collection-members";
import { collectionRulesSchema } from "../../schema";

/**
 * Edit-collection page (docs/11 §4.6). Owner/admin only. Renders the Details form
 * plus — for **manual** collections — the membership manager (`setCollectionProducts`).
 * **Automated** collections show their materialized members read-only (membership
 * is rule-derived; recompute is a V1 stub).
 */

export const metadata: Metadata = { title: "Edit collection" };
export const dynamic = "force-dynamic";

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(NON_STAFF_ROLES);
  const { id } = await params;

  const collection = await prisma.collection.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      heroImageId: true,
      type: true,
      rules: true,
      sortOrder: true,
      isActive: true,
      isFeaturedOnHome: true,
      metaTitle: true,
      metaDescription: true,
      products: {
        orderBy: { sortOrder: "asc" },
        select: {
          sortOrder: true,
          product: {
            select: {
              id: true,
              title: true,
              sku: true,
              price: true,
              isBestseller: true,
              createdAt: true,
              primaryImage: { select: { url: true } },
            },
          },
        },
      },
    },
  });
  if (!collection) notFound();

  // Parse stored rules defensively; fall back to an empty rule set.
  const parsedRules = collectionRulesSchema.safeParse(collection.rules);
  const rules = parsedRules.success
    ? parsedRules.data
    : { match: "all" as const, conditions: [] };

  const initial: CollectionFormValues = {
    id: collection.id,
    title: collection.title,
    slug: collection.slug,
    description: collection.description ?? "",
    heroImageId: collection.heroImageId ?? "",
    type: collection.type,
    rules,
    sortOrder: collection.sortOrder,
    isActive: collection.isActive,
    isFeaturedOnHome: collection.isFeaturedOnHome,
    metaTitle: collection.metaTitle ?? "",
    metaDescription: collection.metaDescription ?? "",
  };

  const members: CollectionMember[] = collection.products.map((cp) => ({
    id: cp.product.id,
    title: cp.product.title,
    sku: cp.product.sku,
    price: cp.product.price,
    imageUrl: cp.product.primaryImage?.url ?? null,
    isBestseller: cp.product.isBestseller,
    createdAt: cp.product.createdAt.toISOString(),
  }));

  const isManual = collection.type === CollectionType.manual;

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
          title={`Edit ${collection.title}`}
          description="Update details, then manage which products appear and in what order."
        />
      </div>

      <CollectionForm initial={initial} />

      {isManual ? (
        <CollectionMembers collectionId={collection.id} initialMembers={members} />
      ) : (
        <Panel
          title="Members (automated)"
          description={`${members.length} product${members.length === 1 ? "" : "s"} matched by rules`}
        >
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-accent/40 px-3 py-2 text-xs text-accent-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              This collection fills automatically from its rules. Membership is read-only
              here; edit the rules above to change what&apos;s included. (Automated
              materialization ships in a later release.)
            </p>
          </div>
          {members.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No products matched yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {members.map((m, i) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-2.5 py-2 sm:px-3"
                >
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    #{i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{m.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.sku} · {formatPaise(m.price)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
