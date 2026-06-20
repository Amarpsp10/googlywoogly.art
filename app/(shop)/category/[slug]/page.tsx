import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getProductsByCategory,
  getCategoryBySlug,
  getAllActiveCategorySlugs,
  listFeaturedCollections,
} from "@/lib/services/catalog";
import { parseProductFilters, type RawSearchParams } from "@/lib/validations/catalog";
import { Container } from "@/components/storefront/container";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { ProductGrid } from "@/components/storefront/product-grid";
import { Pagination } from "@/components/storefront/pagination";
import { EmptyState } from "@/components/storefront/empty-state";
import { CatalogFilters, SortSelect, MobileFilters } from "@/components/storefront/filter-controls";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd, itemListLd, breadcrumbLd } from "@/lib/seo/jsonld";
import { Suspense } from "react";

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getAllActiveCategorySlugs()).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };
  return buildMetadata({
    title: `${category.name} · Handmade Gifts`,
    description: category.description ?? `Shop handmade ${category.name.toLowerCase()} from GooglyWoogly Art.`,
    path: `/category/${category.slug}`,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const result = await getProductsByCategory(slug, parseProductFilters(sp));
  if (!result) notFound();
  const { category, products } = result;
  const collections = await listFeaturedCollections();
  const collectionOptions = collections.map((c) => ({ value: c.slug, label: c.title }));

  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/products" },
    { label: category.name },
  ];

  return (
    <Container as="main" className="py-8 md:py-12">
      <Breadcrumbs items={crumbs} />
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-bold md:text-4xl">{category.name}</h1>
        {category.description && (
          <p className="mt-2 max-w-2xl text-muted-foreground">{category.description}</p>
        )}
      </header>

      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-10">
        <Suspense>
          <aside className="hidden lg:block">
            <CatalogFilters collections={collectionOptions} />
          </aside>
        </Suspense>
        <div>
          <div className="mb-6 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{products.total} items</p>
            <div className="flex items-center gap-2">
              <Suspense>
                <MobileFilters collections={collectionOptions} className="lg:hidden" />
              </Suspense>
              <Suspense>
                <SortSelect />
              </Suspense>
            </div>
          </div>
          {products.items.length > 0 ? (
            <ProductGrid products={products.items} />
          ) : (
            <EmptyState title="Nothing here yet" message="New pieces are added often — check back soon." />
          )}
          <Pagination
            page={products.page}
            totalPages={products.totalPages}
            basePath={`/category/${category.slug}`}
            searchParams={sp}
          />
        </div>
      </div>

      <JsonLd data={breadcrumbLd(crumbs.filter((c) => c.href).map((c) => ({ name: c.label, path: c.href! })))} />
      {products.items.length > 0 && (
        <JsonLd data={itemListLd(products.items.map((p) => ({ name: p.title, path: `/products/${p.slug}` })))} />
      )}
    </Container>
  );
}
