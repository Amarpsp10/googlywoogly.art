import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Package } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { adminListProducts } from "@/lib/services/admin-products";
import { formatPaise } from "@/lib/money";
import { formatDateTimeIST } from "@/lib/format";
import { INVENTORY_STATE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { Toolbar } from "@/components/admin/toolbar";
import { SearchInput } from "@/components/admin/search-input";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { EmptyState } from "@/components/admin/empty-state";
import {
  AdminTable,
  AdminTableHeader,
  AdminTableHead,
  AdminTableBody,
  AdminTableRow,
  AdminTableCell,
} from "@/components/admin/admin-table";
import { StatusFilter } from "@/components/admin/status-filter";
import type { ProductStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Products" };

const STATUS_BADGE: Record<ProductStatus, { tone: "success" | "warning" | "neutral"; label: string }> = {
  active: { tone: "success", label: "Active" },
  draft: { tone: "warning", label: "Draft" },
  archived: { tone: "neutral", label: "Archived" },
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * `/admin/products` — the catalog list (docs/11 FR-52/53). Lists ALL products of
 * any status with thumbnail, title, price, status, stock + derived inventory
 * state. Search (`?q`) over title/SKU, status filter (`?status`), and page-based
 * pagination. Each row links to the editor; an "Add product" button starts a new
 * draft. RSC: reads server-side via `adminListProducts`, requires auth first.
 */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const q = firstParam(sp.q);
  const statusRaw = firstParam(sp.status);
  const status =
    statusRaw === "active" || statusRaw === "draft" || statusRaw === "archived"
      ? statusRaw
      : "all";
  const page = Number(firstParam(sp.page)) || 1;

  const { items, total, totalPages } = await adminListProducts({ q, status, page });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Products"
        description="Create, price, photograph and organize your catalog."
        action={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="size-4" />
              Add product
            </Link>
          </Button>
        }
      />

      <Toolbar
        end={
          <StatusFilter
            param="status"
            value={status}
            options={STATUS_OPTIONS}
            ariaLabel="Filter by status"
          />
        }
      >
        <SearchInput placeholder="Search title or SKU…" ariaLabel="Search products" />
      </Toolbar>

      {items.length === 0 ? (
        <EmptyState
          icon={<Package className="size-6" />}
          title={q || status !== "all" ? "No products match" : "No products yet"}
          description={
            q || status !== "all"
              ? "Try a different search or filter."
              : "Add your first handmade piece to get started."
          }
          action={
            <Button asChild>
              <Link href="/admin/products/new">
                <Plus className="size-4" />
                Add product
              </Link>
            </Button>
          }
        />
      ) : (
        <Panel bodyClassName="p-0 sm:p-0">
          <div className="px-2 py-2 sm:px-3">
            <AdminTable caption="Products">
              <AdminTableHeader>
                <AdminTableHead className="w-14" />
                <AdminTableHead>Product</AdminTableHead>
                <AdminTableHead>Price</AdminTableHead>
                <AdminTableHead>Status</AdminTableHead>
                <AdminTableHead>Stock</AdminTableHead>
                <AdminTableHead>Category</AdminTableHead>
                <AdminTableHead>Updated</AdminTableHead>
              </AdminTableHeader>
              <AdminTableBody>
                {items.map((p) => {
                  const invMeta = INVENTORY_STATE[p.inventoryState];
                  const statusMeta = STATUS_BADGE[p.status];
                  return (
                    <AdminTableRow key={p.id} className="max-md:hover:bg-transparent">
                      <AdminTableCell className="max-md:hidden">
                        <Thumbnail url={p.thumbnailUrl} alt={p.title} />
                      </AdminTableCell>
                      <AdminTableCell label="Product">
                        <Link
                          href={`/admin/products/${p.id}/edit`}
                          className="flex items-center gap-3 font-medium text-foreground hover:text-primary"
                        >
                          <span className="md:hidden">
                            <Thumbnail url={p.thumbnailUrl} alt={p.title} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate">{p.title}</span>
                            <span className="block truncate text-xs font-normal text-muted-foreground">
                              {p.sku}
                            </span>
                          </span>
                        </Link>
                      </AdminTableCell>
                      <AdminTableCell label="Price">
                        <span className="font-medium">{formatPaise(p.price)}</span>
                        {p.compareAtPrice && p.compareAtPrice > p.price ? (
                          <span className="ml-1.5 text-xs text-muted-foreground line-through">
                            {formatPaise(p.compareAtPrice)}
                          </span>
                        ) : null}
                      </AdminTableCell>
                      <AdminTableCell label="Status">
                        <StatusBadge tone={statusMeta.tone} label={statusMeta.label} />
                      </AdminTableCell>
                      <AdminTableCell label="Stock">
                        <StatusBadge tone={invMeta.tone} label={stockLabel(p)} />
                      </AdminTableCell>
                      <AdminTableCell label="Category">
                        <span className="text-muted-foreground">{p.categoryName ?? "—"}</span>
                      </AdminTableCell>
                      <AdminTableCell label="Updated">
                        <span className="text-xs text-muted-foreground">
                          {formatDateTimeIST(p.updatedAt)}
                        </span>
                      </AdminTableCell>
                    </AdminTableRow>
                  );
                })}
              </AdminTableBody>
            </AdminTable>
          </div>
          <div className="border-t border-border px-4 py-3 sm:px-5">
            <AdminPagination
              page={page}
              totalPages={totalPages}
              basePath="/admin/products"
              searchParams={sp}
              total={total}
            />
          </div>
        </Panel>
      )}
    </div>
  );
}

function Thumbnail({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
        <Package className="size-4" aria-hidden />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt={alt}
      className="size-10 rounded-lg border border-border object-cover"
    />
  );
}

function stockLabel(p: {
  inventoryState: keyof typeof INVENTORY_STATE;
  inventoryQuantity: number;
  productionLeadTimeDays: number | null;
}): string {
  switch (p.inventoryState) {
    case "made_to_order":
      return p.productionLeadTimeDays ? `MTO · ${p.productionLeadTimeDays}d` : "Made to order";
    case "out_of_stock":
      return "Out of stock";
    case "low_stock":
      return `Low (${p.inventoryQuantity})`;
    case "in_stock":
      return `In stock (${p.inventoryQuantity})`;
    default:
      return "—";
  }
}
