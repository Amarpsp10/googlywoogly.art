import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { History } from "lucide-react";
import { requireRole, hidesFinancials } from "@/lib/auth";
import {
  adminGetProductById,
  getProductFormTaxonomy,
  getDistinctTags,
  getInventoryAdjustments,
} from "@/lib/services/admin-products";
import { formatDateTimeIST } from "@/lib/format";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { ProductForm } from "@/components/admin/product-form";
import { features } from "@/lib/env";

export const metadata: Metadata = { title: "Edit product" };

/**
 * `/admin/products/[id]/edit` — edit an existing product (any status) with the
 * shared `<ProductForm>` (docs/11 FR-1). Owner/admin only. `[id]` is the internal
 * cuid (IDs are allowed in admin URLs, never on the storefront). Also renders the
 * per-product stock adjustment history projected from `AuditLog` (FR-47).
 */
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireRole(["owner", "admin"]);
  const { id } = await params;

  const product = await adminGetProductById(id);
  if (!product) notFound();

  const [{ categories, collections }, tagSuggestions, adjustments] = await Promise.all([
    getProductFormTaxonomy(),
    getDistinctTags(),
    getInventoryAdjustments(id),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={product.title || "Untitled product"}
        description={`Last updated ${formatDateTimeIST(product.updatedAt)} IST`}
      />

      <ProductForm
        product={product}
        categories={categories}
        collections={collections}
        tagSuggestions={tagSuggestions}
        canEditCost={!hidesFinancials(admin.role)}
        uploadEnabled={features.cloudinary}
      />

      {adjustments.length > 0 ? (
        <Panel
          title="Stock history"
          description="Every adjustment to this product's stock."
        >
          <ul className="divide-y divide-border">
            {adjustments.map((a) => {
              const after = (a.after ?? {}) as {
                inventoryQuantity?: number;
                reason?: string;
                delta?: number;
                note?: string | null;
              };
              const before = (a.before ?? {}) as { inventoryQuantity?: number };
              return (
                <li key={a.id} className="flex items-start gap-3 py-2.5 text-sm">
                  <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground">
                      {before.inventoryQuantity ?? "?"} → {after.inventoryQuantity ?? "?"}
                      {typeof after.delta === "number" ? (
                        <span className="ml-1 text-muted-foreground">
                          ({after.delta >= 0 ? "+" : ""}
                          {after.delta})
                        </span>
                      ) : null}
                      {after.reason ? (
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {humanizeReason(after.reason)}
                        </span>
                      ) : null}
                    </p>
                    {after.note ? (
                      <p className="text-xs text-muted-foreground">{after.note}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {a.adminName} · {formatDateTimeIST(a.createdAt)} IST
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

/** Turn a snake_case adjustment reason into friendly copy (docs/11 §4.9). */
function humanizeReason(reason: string): string {
  const map: Record<string, string> = {
    recount: "Recount",
    received_stock: "Received stock",
    damaged: "Damaged",
    lost: "Lost",
    returned_to_stock: "Returned to stock",
    correction: "Correction",
    sold_offline: "Sold in person",
    other: "Other",
  };
  return map[reason] ?? reason;
}
