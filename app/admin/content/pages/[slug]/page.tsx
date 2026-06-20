import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldAlert } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { NON_STAFF_ROLES } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { formatDateIST } from "@/lib/format";
import { cmsPageDef } from "@/lib/admin/content-shared";
import { CmsPageEditor } from "./page-editor";
import { MarkReviewedButton } from "./mark-reviewed";
import { templateFor } from "./templates";

/**
 * `/admin/content/pages/[slug]` — the full-screen CMS page editor (doc 15 §4.6).
 * `requireRole(owner|admin)`. The slug MUST be in the reserved fixed set (FR-19);
 * anything else 404s. Legal pages surface the review reminder + "Mark reviewed"
 * (FR-37). When no row exists yet, the storefront shows code-default text (FR-21).
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const def = cmsPageDef(slug);
  return { title: def ? `Edit ${def.name}` : "Page" };
}

export default async function CmsPageEditorRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireRole(NON_STAFF_ROLES);

  const { slug } = await params;
  const def = cmsPageDef(slug);
  if (!def) notFound(); // only reserved content/legal slugs are editable (FR-19)

  const row = await prisma.cmsPage.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      bodyRich: true,
      metaTitle: true,
      metaDescription: true,
      isPublished: true,
      updatedAt: true,
      lastReviewedAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/content?tab=pages"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back to pages
        </Link>
        <AdminPageHeader
          title={def.name}
          description={
            row
              ? `Last updated ${formatDateIST(row.updatedAt)}${
                  row.lastReviewedAt ? ` · reviewed ${formatDateIST(row.lastReviewedAt)}` : ""
                }`
              : "No content saved yet — the storefront shows the default text."
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              {def.legal ? <MarkReviewedButton id={row?.id} /> : null}
              <Button asChild variant="outline" size="sm" className="min-h-9">
                <Link href={`/${slug}`} target="_blank" rel="noopener">
                  View live <ExternalLink className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
          }
        />
      </div>

      {def.legal ? (
        <div
          role="note"
          className="flex items-start gap-2 rounded-xl border border-accent/50 bg-accent/15 px-4 py-3 text-sm text-accent-foreground"
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            This is a legal page. Please have the content reviewed before publishing — the
            outline provided is a starting point, not legal advice. Use{" "}
            <strong>Mark as reviewed</strong> once checked.
          </p>
        </div>
      ) : null}

      {def.hasChrome ? (
        <p className="rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
          The form/accordion on this page is built into the storefront. This copy appears
          above it.
        </p>
      ) : null}

      <CmsPageEditor
        data={{
          id: row?.id,
          slug,
          title: row?.title ?? def.name,
          bodyRich: row?.bodyRich ?? "",
          metaTitle: row?.metaTitle,
          metaDescription: row?.metaDescription,
          isPublished: row?.isPublished ?? false,
          updatedAt: row?.updatedAt.toISOString(),
        }}
        defaultTemplate={templateFor(slug)}
      />
    </div>
  );
}
