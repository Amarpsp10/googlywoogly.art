import Link from "next/link";
import type { Metadata } from "next";
import { ContactStatus } from "@prisma/client";
import { MessagesSquare, ArrowRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { adminListContactMessages } from "@/lib/services/leads";
import { CONTACT_STATUS } from "@/lib/constants";
import { formatDateTimeIST } from "@/lib/format";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { Toolbar } from "@/components/admin/toolbar";
import { SearchInput } from "@/components/admin/search-input";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { StatusFilterSelect } from "@/components/admin/crm/status-filter-select";
import {
  AdminTable,
  AdminTableHeader,
  AdminTableHead,
  AdminTableBody,
  AdminTableRow,
  AdminTableCell,
} from "@/components/admin/admin-table";

export const metadata: Metadata = { title: "Messages" };

const PAGE_SIZE = 25;

const STATUS_OPTIONS = Object.entries(CONTACT_STATUS).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

function parseStatus(value: string | undefined): ContactStatus | undefined {
  return value && value in ContactStatus
    ? ContactStatus[value as keyof typeof ContactStatus]
    : undefined;
}

function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1;
}

/** Single-line excerpt for the list (full body on the detail). */
function excerpt(text: string, max = 80): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const status = parseStatus(typeof sp.status === "string" ? sp.status : undefined);
  const search = typeof sp.q === "string" ? sp.q : undefined;
  const page = parsePage(typeof sp.page === "string" ? sp.page : undefined);

  const { items, total } = await adminListContactMessages({
    status,
    search,
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Messages"
        description="Contact-form messages from the storefront."
      />

      <Panel
        bodyClassName="space-y-4"
        title="Inbox"
        description={`${total} ${total === 1 ? "message" : "messages"}${status ? ` · ${CONTACT_STATUS[status].label}` : ""}`}
      >
        <Toolbar>
          <SearchInput placeholder="Search name, email, subject…" />
          <StatusFilterSelect
            options={STATUS_OPTIONS}
            allLabel="All statuses"
            ariaLabel="Filter by message status"
          />
        </Toolbar>

        {items.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare className="size-6" />}
            title={search || status ? "No matching messages" : "Inbox zero"}
            description={
              search || status
                ? "Try a different search or clear the filter."
                : "Messages sent through the contact form will land here."
            }
          />
        ) : (
          <>
            <AdminTable caption="Contact messages">
              <AdminTableHeader>
                <AdminTableHead>From</AdminTableHead>
                <AdminTableHead>Subject</AdminTableHead>
                <AdminTableHead>Received</AdminTableHead>
                <AdminTableHead>Status</AdminTableHead>
                <AdminTableHead className="text-right">Open</AdminTableHead>
              </AdminTableHeader>
              <AdminTableBody>
                {items.map((msg) => {
                  const meta = CONTACT_STATUS[msg.status];
                  return (
                    <AdminTableRow key={msg.id}>
                      <AdminTableCell label="From">
                        <Link
                          href={`/admin/messages/${msg.id}`}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {msg.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{msg.email}</div>
                      </AdminTableCell>
                      <AdminTableCell label="Subject">
                        <span className="text-sm">{msg.subject || "—"}</span>
                        <div className="text-xs text-muted-foreground">
                          {excerpt(msg.message)}
                        </div>
                      </AdminTableCell>
                      <AdminTableCell label="Received">
                        <span className="text-sm text-muted-foreground">
                          {formatDateTimeIST(msg.createdAt)}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell label="Status">
                        <StatusBadge tone={meta.tone} label={meta.label} />
                      </AdminTableCell>
                      <AdminTableCell label="" className="text-right">
                        <Link
                          href={`/admin/messages/${msg.id}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                          aria-label={`Open message from ${msg.name}`}
                        >
                          Open
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </AdminTableCell>
                    </AdminTableRow>
                  );
                })}
              </AdminTableBody>
            </AdminTable>

            <AdminPagination
              page={page}
              totalPages={totalPages}
              total={total}
              basePath="/admin/messages"
              searchParams={sp}
            />
          </>
        )}
      </Panel>
    </div>
  );
}
