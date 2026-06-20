import type { Metadata } from "next";
import { ScrollText } from "lucide-react";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { formatDateTimeIST } from "@/lib/format";

import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  AdminTable,
  AdminTableHeader,
  AdminTableHead,
  AdminTableBody,
  AdminTableRow,
  AdminTableCell,
} from "@/components/admin/admin-table";

/**
 * Audit-log viewer (doc 10 §4.10, FR-48). A read-only, reverse-chronological
 * feed of `AuditLog` rows — who did what, to which entity, when (IST). The log
 * is **append-only** and **PII-redacted at write time** (see `lib/admin/audit.ts`),
 * so this page only reads + paginates.
 *
 * Gated to **owner/admin** (`requireRole`) per this task's contract — the real
 * server-side authz gate, not just sidebar visibility. Always dynamic (reads the
 * live log + the session cookie), so it is never statically cached.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Audit log",
};

/** Rows per page for the audit feed. */
const PAGE_SIZE = 25;

/** Columns surfaced in the viewer (no `before`/`after` blobs in the list). */
const auditListSelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  createdAt: true,
  admin: { select: { name: true, email: true } },
} satisfies Prisma.AuditLogSelect;

type AuditRow = Prisma.AuditLogGetPayload<{ select: typeof auditListSelect }>;

/** Parse the 1-based `page` query param defensively. */
function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Owner/admin only — server-side gate (doc 10 FR-22/§5.4).
  await requireRole(["owner", "admin"]);

  const sp = await searchParams;
  const requestedPage = parsePage(sp.page);

  const [total, rowsForRequestedPage] = await prisma.$transaction([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      select: auditListSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (requestedPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Clamp out-of-range requests so a stale/typed page never shows a blank table.
  const page = Math.min(requestedPage, totalPages);
  const rows =
    page === requestedPage
      ? rowsForRequestedPage
      : await prisma.auditLog.findMany({
          select: auditListSelect,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Audit log"
        description="Every change admins make, newest first. Read-only and append-only."
      />

      <Panel bodyClassName={rows.length ? "p-0 sm:p-0" : undefined}>
        {rows.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="size-6" />}
            title="No audit entries yet"
            description="Admin actions — product edits, order updates, settings changes — will be recorded here."
          />
        ) : (
          <AdminTable caption="Admin audit log">
            <AdminTableHeader>
              <AdminTableHead>When (IST)</AdminTableHead>
              <AdminTableHead>Admin</AdminTableHead>
              <AdminTableHead>Action</AdminTableHead>
              <AdminTableHead>Entity</AdminTableHead>
            </AdminTableHeader>
            <AdminTableBody>
              {rows.map((row) => (
                <AuditRowView key={row.id} row={row} />
              ))}
            </AdminTableBody>
          </AdminTable>
        )}
      </Panel>

      {rows.length > 0 ? (
        <AdminPagination
          page={page}
          totalPages={totalPages}
          basePath="/admin/audit-log"
          searchParams={sp}
          total={total}
        />
      ) : null}
    </div>
  );
}

function AuditRowView({ row }: { row: AuditRow }) {
  const who = row.admin?.name ?? "Unknown admin";
  return (
    <AdminTableRow>
      <AdminTableCell label="When (IST)" className="whitespace-nowrap text-muted-foreground">
        {formatDateTimeIST(row.createdAt)}
      </AdminTableCell>
      <AdminTableCell label="Admin">
        <span className="font-medium text-foreground">{who}</span>
      </AdminTableCell>
      <AdminTableCell label="Action">
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
          {row.action}
        </code>
      </AdminTableCell>
      <AdminTableCell label="Entity" className="text-muted-foreground">
        <span className="font-medium text-foreground">{row.entityType}</span>
        <span className="ml-1 text-xs text-muted-foreground">{row.entityId}</span>
      </AdminTableCell>
    </AdminTableRow>
  );
}
