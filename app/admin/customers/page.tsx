import Link from "next/link";
import type { Metadata } from "next";
import { Users, ArrowRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { adminListCustomers, ADMIN_CUSTOMERS_PAGE_SIZE } from "@/lib/admin/crm";
import { formatPaise } from "@/lib/money";
import { formatDateIST } from "@/lib/format";
import { formatPhoneDisplay } from "@/lib/admin/phone";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { Toolbar } from "@/components/admin/toolbar";
import { SearchInput } from "@/components/admin/search-input";
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

export const metadata: Metadata = { title: "Customers" };

function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;

  const search = typeof sp.q === "string" ? sp.q : undefined;
  const page = parsePage(typeof sp.page === "string" ? sp.page : undefined);

  const { items, total, totalPages } = await adminListCustomers(admin.role, {
    query: search,
    page,
    pageSize: ADMIN_CUSTOMERS_PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Customers"
        description="Everyone who has placed an order, derived from your orders."
      />

      <Panel
        bodyClassName="space-y-4"
        title="Directory"
        description={`${total} ${total === 1 ? "customer" : "customers"}`}
      >
        <Toolbar>
          <SearchInput placeholder="Search name, phone, email…" />
        </Toolbar>

        {items.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title={search ? "No matching customers" : "No customers yet"}
            description={
              search
                ? "Try a different name, phone, or email."
                : "Customers are created when an order is placed. They'll appear here."
            }
          />
        ) : (
          <>
            <AdminTable caption="Customers">
              <AdminTableHeader>
                <AdminTableHead>Name</AdminTableHead>
                <AdminTableHead>Contact</AdminTableHead>
                <AdminTableHead className="text-right">Orders</AdminTableHead>
                <AdminTableHead className="text-right">Requested</AdminTableHead>
                <AdminTableHead>Last order</AdminTableHead>
                <AdminTableHead className="text-right">Open</AdminTableHead>
              </AdminTableHeader>
              <AdminTableBody>
                {items.map((c) => (
                  <AdminTableRow key={c.id}>
                    <AdminTableCell label="Name">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {c.name}
                      </Link>
                      {c.tags.length > 0 ? (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {c.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </AdminTableCell>
                    <AdminTableCell label="Contact">
                      <div className="text-sm">{formatPhoneDisplay(c.phone)}</div>
                      {c.email ? (
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      ) : null}
                    </AdminTableCell>
                    <AdminTableCell label="Orders" className="text-right">
                      {c.ordersCount}
                    </AdminTableCell>
                    <AdminTableCell label="Requested" className="text-right">
                      {c.totalRequested != null ? (
                        formatPaise(c.totalRequested)
                      ) : (
                        <span className="text-muted-foreground" aria-hidden>
                          —
                        </span>
                      )}
                    </AdminTableCell>
                    <AdminTableCell label="Last order">
                      <span className="text-sm text-muted-foreground">
                        {c.lastOrderAt ? formatDateIST(c.lastOrderAt) : "—"}
                      </span>
                    </AdminTableCell>
                    <AdminTableCell label="" className="text-right">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        aria-label={`Open ${c.name}`}
                      >
                        Open
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
              </AdminTableBody>
            </AdminTable>

            <AdminPagination
              page={page}
              totalPages={totalPages}
              total={total}
              basePath="/admin/customers"
              searchParams={sp}
            />
          </>
        )}
      </Panel>
    </div>
  );
}
