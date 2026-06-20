import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { parseProductFilters, type RawSearchParams } from "@/lib/validations/catalog";
import {
  getProducts,
  listActiveCategories,
  listFeaturedCollections,
} from "@/lib/services/catalog";
import { Container } from "@/components/storefront/container";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { ProductGrid } from "@/components/storefront/product-grid";
import { Pagination } from "@/components/storefront/pagination";
import { EmptyState } from "@/components/storefront/empty-state";
import { CatalogFilters, SortSelect, MobileFilters } from "@/components/storefront/filter-controls";
import { Button } from "@/components/ui/button";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd, itemListLd } from "@/lib/seo/jsonld";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "Shop all handmade gifts & décor",
  description:
    "Browse handmade gifts and home décor, crafted in Jaipur. Filter by category, collection, price and availability.",
  path: "/products",
});

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const params = parseProductFilters(sp);
  const [data, categories, collections] = await Promise.all([
    getProducts(params),
    listActiveCategories(),
    listFeaturedCollections(),
  ]);

  const categoryOptions = categories.map((c) => ({ value: c.slug, label: c.name }));
  const collectionOptions = collections.map((c) => ({ value: c.slug, label: c.title }));

  return (
    <Container as="main" className="py-8 md:py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop" }]} />
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-bold md:text-4xl">All Handmade Gifts</h1>
        <p className="mt-2 text-muted-foreground">
          Each piece is lovingly crafted by hand — find the perfect one.
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-10">
        <Suspense>
          <aside className="hidden lg:block">
            <CatalogFilters categories={categoryOptions} collections={collectionOptions} />
          </aside>
        </Suspense>

        <div>
          <div className="mb-6 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {data.total} {data.total === 1 ? "item" : "items"}
            </p>
            <div className="flex items-center gap-2">
              <Suspense>
                <MobileFilters
                  categories={categoryOptions}
                  collections={collectionOptions}
                  className="lg:hidden"
                />
              </Suspense>
              <Suspense>
                <SortSelect />
              </Suspense>
            </div>
          </div>

          {data.items.length > 0 ? (
            <ProductGrid products={data.items} />
          ) : (
            <EmptyState
              title="No products match your filters"
              message="Try removing a filter or browse everything."
              action={
                <Button asChild className="rounded-full">
                  <Link href="/products">View all products</Link>
                </Button>
              }
            />
          )}

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            basePath="/products"
            searchParams={sp}
          />
        </div>
      </div>

      {data.items.length > 0 && (
        <JsonLd
          data={itemListLd(
            data.items.map((p) => ({ name: p.title, path: `/products/${p.slug}` })),
          )}
        />
      )}
    </Container>
  );
}
