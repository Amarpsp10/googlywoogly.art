/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { ImageIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { formatDateIST } from "@/lib/format";
import { EditorSheet } from "../content/_components/editor-sheet";
import { AddMediaForm } from "./add-media-form";
import { CopyId } from "./copy-id";
import { DeleteMediaButton } from "./delete-media-button";

/**
 * `/admin/media` — a simple media library grid (doc 15 §5.2 MVP). Open to all
 * admins (`requireAdmin`). Lists `MediaAsset` rows with previews; add by URL and
 * delete (guarded against in-use assets). Image previews use a plain `<img>` (the
 * admin isn't perf-critical and URLs are arbitrary hosts).
 */

export const metadata: Metadata = { title: "Media" };

const PAGE_SIZE = 24;

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const [assets, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        url: true,
        alt: true,
        type: true,
        width: true,
        height: true,
        folder: true,
        createdAt: true,
      },
    }),
    prisma.mediaAsset.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Media"
        description="Your image library. Add by URL, then reference assets by ID in the editors."
        action={
          <EditorSheet
            title="Add media"
            description="Register an image by URL."
            triggerLabel="Add media"
            triggerIcon="add"
            triggerVariant="default"
          >
            <AddMediaForm />
          </EditorSheet>
        }
      />

      <Panel>
        {assets.length === 0 ? (
          <EmptyState
            icon={<ImageIcon className="size-6" />}
            title="No media yet"
            description="Add your first image by URL to start building your library."
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => (
              <li
                key={asset.id}
                className="group overflow-hidden rounded-2xl border border-border bg-card"
              >
                <div className="relative aspect-square bg-muted">
                  {asset.type === "image" ? (
                    <img
                      src={asset.url}
                      alt={asset.alt ?? ""}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="size-8" />
                    </div>
                  )}
                  <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <DeleteMediaButton id={asset.id} />
                  </div>
                </div>
                <div className="space-y-1 p-2.5">
                  <p className="truncate text-xs font-medium text-foreground" title={asset.alt ?? undefined}>
                    {asset.alt || "Untitled"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ""}
                    {formatDateIST(asset.createdAt)}
                  </p>
                  <CopyId id={asset.id} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <div className="mt-5">
            <AdminPagination
              page={page}
              totalPages={totalPages}
              basePath="/admin/media"
              searchParams={{ page: pageParam }}
              total={total}
            />
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
