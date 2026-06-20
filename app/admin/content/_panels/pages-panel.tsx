import Link from "next/link";
import { Pencil } from "lucide-react";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/admin/panel";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  AdminTable,
  AdminTableHeader,
  AdminTableHead,
  AdminTableBody,
  AdminTableRow,
  AdminTableCell,
} from "@/components/admin/admin-table";
import { Button } from "@/components/ui/button";
import { formatDateIST } from "@/lib/format";
import { CMS_PAGES } from "@/lib/admin/content-shared";

/**
 * Pages tab (doc 15 §4.6) — the fixed content/legal page catalogue joined to any
 * existing `CmsPage` row by slug. Each row deep-links to the full-screen page
 * editor. Pages with no row yet are "Default" (the storefront shows code-default
 * text until published, FR-21).
 */
export async function PagesPanel() {
  const rows = await prisma.cmsPage.findMany({
    where: { slug: { in: CMS_PAGES.map((p) => p.slug) } },
    select: {
      slug: true,
      isPublished: true,
      updatedAt: true,
      lastReviewedAt: true,
    },
  });
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  return (
    <Panel
      title="Content & legal pages"
      description="Edit your About, policies, and care guide. Legal pages show a review reminder."
    >
      <AdminTable>
        <AdminTableHeader>
          <AdminTableHead>Page</AdminTableHead>
          <AdminTableHead>Slug</AdminTableHead>
          <AdminTableHead>Status</AdminTableHead>
          <AdminTableHead>Updated</AdminTableHead>
          <AdminTableHead className="text-right">Edit</AdminTableHead>
        </AdminTableHeader>
        <AdminTableBody>
          {CMS_PAGES.map((def) => {
            const row = bySlug.get(def.slug);
            const published = row?.isPublished ?? false;
            return (
              <AdminTableRow key={def.slug}>
                <AdminTableCell label="Page">
                  <span className="font-medium text-foreground">{def.name}</span>
                  {def.legal ? (
                    <span className="ml-2 text-xs text-muted-foreground">(legal)</span>
                  ) : null}
                </AdminTableCell>
                <AdminTableCell label="Slug">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/{def.slug}</code>
                </AdminTableCell>
                <AdminTableCell label="Status">
                  {row ? (
                    <StatusBadge
                      tone={published ? "success" : "neutral"}
                      label={published ? "Published" : "Draft"}
                    />
                  ) : (
                    <StatusBadge tone="info" label="Default text" />
                  )}
                </AdminTableCell>
                <AdminTableCell label="Updated">
                  <span className="text-xs text-muted-foreground">
                    {row ? formatDateIST(row.updatedAt) : "—"}
                    {def.legal && row?.lastReviewedAt ? (
                      <span className="block">Reviewed {formatDateIST(row.lastReviewedAt)}</span>
                    ) : null}
                  </span>
                </AdminTableCell>
                <AdminTableCell label="" className="text-right">
                  <Button asChild variant="outline" size="sm" className="min-h-9">
                    <Link href={`/admin/content/pages/${def.slug}`}>
                      <Pencil className="size-4" aria-hidden />
                      Edit
                    </Link>
                  </Button>
                </AdminTableCell>
              </AdminTableRow>
            );
          })}
        </AdminTableBody>
      </AdminTable>
    </Panel>
  );
}
