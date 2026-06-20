import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import {
  getCollectionProducts,
  getCollectionBySlug,
  getAllActiveCollectionSlugs,
  listActiveCategories,
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
  return (await getAllActiveCollectionSlugs()).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) return { title: "Collection not found" };
  return buildMetadata({
    title: `${collection.title} · GooglyWoogly Art`,
    description: collection.description ?? `Shop the ${collection.title} collection — handmade gifts & décor.`,
    path: `/collections/${collection.slug}`,
    images: collection.heroImage ? [{ url: collection.heroImage.url, alt: collection.title }] : undefined,
  });
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const result = await getCollectionProducts(slug, parseProductFilters(sp));
  if (!result) notFound();
  const { collection, products } = result;
  const categories = await listActiveCategories();
  const categoryOptions = categories.map((c) => ({ value: c.slug, label: c.name }));

  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Collections", href: "/products" },
    { label: collection.title },
  ];

  return (
    <Container as="main" className="py-8 md:py-12">
      <Breadcrumbs items={crumbs} />

      <header className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-pastel-pink/40 via-pastel-lavender/30 to-pastel-mint/30 p-8 md:p-12">
        {collection.heroImage && (
          <Image
            src={collection.heroImage.url}
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-20"
          />
        )}
        <div className="relative max-w-2xl">
          <h1 className="font-serif text-3xl font-bold md:text-4xl lg:text-5xl">{collection.title}</h1>
          {collection.description && (
            <p className="mt-3 text-muted-foreground text-pretty">{collection.description}</p>
          )}
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-10">
        <Suspense>
          <aside className="hidden lg:block">
            <CatalogFilters categories={categoryOptions} />
          </aside>
        </Suspense>
        <div>
          <div className="mb-6 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{products.total} items</p>
            <div className="flex items-center gap-2">
              <Suspense>
                <MobileFilters categories={categoryOptions} className="lg:hidden" />
              </Suspense>
              <Suspense>
                <SortSelect />
              </Suspense>
            </div>
          </div>
          {products.items.length > 0 ? (
            <ProductGrid products={products.items} />
          ) : (
            <EmptyState title="Nothing here yet" message="This collection is being curated — check back soon." />
          )}
          <Pagination
            page={products.page}
            totalPages={products.totalPages}
            basePath={`/collections/${collection.slug}`}
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
