import Link from "next/link";
import type { Metadata } from "next";
import { InquiryStatus } from "@prisma/client";
import { Briefcase, ArrowRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { adminListBulkInquiries } from "@/lib/services/leads";
import { INQUIRY_STATUS } from "@/lib/constants";
import { formatPaise } from "@/lib/money";
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

export const metadata: Metadata = { title: "Bulk Inquiries" };

const PAGE_SIZE = 25;

const STATUS_OPTIONS = Object.entries(INQUIRY_STATUS).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

/** Narrow an arbitrary `?status=` value to the enum, else undefined (= all). */
function parseStatus(value: string | undefined): InquiryStatus | undefined {
  return value && value in InquiryStatus
    ? InquiryStatus[value as keyof typeof InquiryStatus]
    : undefined;
}

function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1;
}

export default async function BulkInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const status = parseStatus(typeof sp.status === "string" ? sp.status : undefined);
  const search = typeof sp.q === "string" ? sp.q : undefined;
  const page = parsePage(typeof sp.page === "string" ? sp.page : undefined);

  const { items, total } = await adminListBulkInquiries({
    status,
    search,
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Bulk Inquiries"
        description="Corporate & bulk-gifting leads. Work them down the pipeline."
      />

      <Panel
        bodyClassName="space-y-4"
        title="Pipeline"
        description={`${total} ${total === 1 ? "inquiry" : "inquiries"}${status ? ` · ${INQUIRY_STATUS[status].label}` : ""}`}
      >
        <Toolbar>
          <SearchInput placeholder="Search name, company, email, phone…" />
          <StatusFilterSelect
            options={STATUS_OPTIONS}
            allLabel="All statuses"
            ariaLabel="Filter by inquiry status"
          />
        </Toolbar>

        {items.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="size-6" />}
            title={search || status ? "No matching inquiries" : "No inquiries yet"}
            description={
              search || status
                ? "Try a different search or clear the filter."
                : "Bulk-gifting enquiries from the storefront will appear here."
            }
          />
        ) : (
          <>
            <AdminTable caption="Bulk inquiries">
              <AdminTableHeader>
                <AdminTableHead>Contact</AdminTableHead>
                <AdminTableHead>Interest</AdminTableHead>
                <AdminTableHead>Budget</AdminTableHead>
                <AdminTableHead>Received</AdminTableHead>
                <AdminTableHead>Status</AdminTableHead>
                <AdminTableHead className="text-right">Open</AdminTableHead>
              </AdminTableHeader>
              <AdminTableBody>
                {items.map((inq) => {
                  const meta = INQUIRY_STATUS[inq.status];
                  return (
                    <AdminTableRow key={inq.id}>
                      <AdminTableCell label="Contact">
                        <Link
                          href={`/admin/bulk-inquiries/${inq.id}`}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {inq.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {inq.company ? `${inq.company} · ` : ""}
                          {inq.email}
                        </div>
                      </AdminTableCell>
                      <AdminTableCell label="Interest">
                        <span className="text-sm">
                          {inq.productInterest || inq.occasion || "—"}
                          {inq.quantity ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · qty {inq.quantity}
                            </span>
                          ) : null}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell label="Budget">
                        {inq.budget != null ? (
                          formatPaise(inq.budget)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </AdminTableCell>
                      <AdminTableCell label="Received">
                        <span className="text-sm text-muted-foreground">
                          {formatDateTimeIST(inq.createdAt)}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell label="Status">
                        <StatusBadge tone={meta.tone} label={meta.label} />
                      </AdminTableCell>
                      <AdminTableCell label="" className="text-right">
                        <Link
                          href={`/admin/bulk-inquiries/${inq.id}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                          aria-label={`Open inquiry from ${inq.name}`}
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
              basePath="/admin/bulk-inquiries"
              searchParams={sp}
            />
          </>
        )}
      </Panel>
    </div>
  );
}
