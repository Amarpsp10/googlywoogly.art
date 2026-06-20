import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import {
  adminListInventory,
  type InventoryFilter,
} from "@/lib/services/admin-products";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { Toolbar } from "@/components/admin/toolbar";
import { SearchInput } from "@/components/admin/search-input";
import { StatusFilter } from "@/components/admin/status-filter";
import { EmptyState } from "@/components/admin/empty-state";
import {
  AdminTable,
  AdminTableHeader,
  AdminTableHead,
  AdminTableBody,
} from "@/components/admin/admin-table";
import { InventoryRow } from "@/components/admin/inventory-row";

export const metadata: Metadata = { title: "Inventory" };

const FILTER_OPTIONS = [
  { value: "all", label: "All stock" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
  { value: "in", label: "In stock" },
  { value: "mto", label: "Made to order" },
];

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const VALID_FILTERS: readonly InventoryFilter[] = ["all", "low", "out", "in", "mto"];

/**
 * `/admin/inventory` — the stock-focused console (docs/11 FR-43–48). A table of
 * all non-archived products with derived state, inline quick-edit of qty / low
 * threshold / made-to-order, and a reasoned "Adjust" sheet. Quick filters for
 * Low / Out / In / Made-to-order; SKU/title search. Writable by `staff`+ (the
 * one catalog-write surface staff has). Deep-linkable via `?filter=low` from the
 * dashboard. RSC; requires auth first.
 */
export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const q = firstParam(sp.q);
  const filterRaw = firstParam(sp.filter);
  const filter: InventoryFilter = VALID_FILTERS.includes(filterRaw as InventoryFilter)
    ? (filterRaw as InventoryFilter)
    : "all";

  const { items, counts } = await adminListInventory({ q, filter });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Inventory"
        description="Keep stock accurate — adjust quantities with a reason."
      />

      <Toolbar
        end={
          <p className="text-xs text-muted-foreground">
            Low: <span className="font-medium text-foreground">{counts.low}</span> · Out:{" "}
            <span className="font-medium text-foreground">{counts.out}</span>
          </p>
        }
      >
        <SearchInput placeholder="Search title or SKU…" ariaLabel="Search inventory" />
        <StatusFilter
          param="filter"
          value={filter}
          options={FILTER_OPTIONS}
          ariaLabel="Filter by stock state"
        />
      </Toolbar>

      {items.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-6" />}
          title={q || filter !== "all" ? "Nothing matches" : "No products to stock"}
          description={
            q || filter !== "all"
              ? "Try a different search or filter."
              : "Add a product to start tracking stock."
          }
        />
      ) : (
        <Panel bodyClassName="p-0 sm:p-0">
          <div className="px-2 py-2 sm:px-3">
            <AdminTable caption="Inventory">
              <AdminTableHeader>
                <AdminTableHead className="w-14" />
                <AdminTableHead>Product</AdminTableHead>
                <AdminTableHead>State</AdminTableHead>
                <AdminTableHead>Qty</AdminTableHead>
                <AdminTableHead>Low ≤</AdminTableHead>
                <AdminTableHead>MTO</AdminTableHead>
                <AdminTableHead>Lead</AdminTableHead>
                <AdminTableHead>Adjust</AdminTableHead>
              </AdminTableHeader>
              <AdminTableBody>
                {items.map((row) => (
                  <InventoryRow key={row.id} row={row} />
                ))}
              </AdminTableBody>
            </AdminTable>
          </div>
        </Panel>
      )}
    </div>
  );
}
