import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { hidesFinancials } from "@/lib/auth";
import {
  getProductFormTaxonomy,
  getDistinctTags,
} from "@/lib/services/admin-products";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";
import { features } from "@/lib/env";

export const metadata: Metadata = { title: "New product" };

/**
 * `/admin/products/new` — start a new product from an empty draft (docs/11 FR-1).
 * Owner/admin only (`staff` can't create products — docs/11 §1.3). Loads the
 * taxonomy + tag suggestions server-side and hands them to the shared
 * `<ProductForm>` with `product={null}`.
 */
export default async function NewProductPage() {
  const admin = await requireRole(["owner", "admin"]);

  const [{ categories, collections }, tagSuggestions] = await Promise.all([
    getProductFormTaxonomy(),
    getDistinctTags(),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="New product"
        description="Type a title, add a few photos, set a price — then publish."
      />
      <ProductForm
        product={null}
        categories={categories}
        collections={collections}
        tagSuggestions={tagSuggestions}
        canEditCost={!hidesFinancials(admin.role)}
        uploadEnabled={features.cloudinary}
      />
    </div>
  );
}
