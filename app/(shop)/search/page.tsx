import type { Metadata } from "next";
import Link from "next/link";
import { searchProducts, listActiveCategories } from "@/lib/services/catalog";
import { parseProductFilters, type RawSearchParams } from "@/lib/validations/catalog";
import { Container } from "@/components/storefront/container";
import { ProductGrid } from "@/components/storefront/product-grid";
import { Pagination } from "@/components/storefront/pagination";
import { EmptyState } from "@/components/storefront/empty-state";
import { buildMetadata } from "@/lib/seo/metadata";
import { TrackView } from "@/components/analytics/track-view";
import { Search as SearchIcon } from "lucide-react";

export const metadata: Metadata = buildMetadata({
  title: "Search",
  description: "Search handmade gifts and décor.",
  path: "/search",
  noindex: true,
});

function firstQ(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const q = firstQ(sp.q).trim();
  const params = parseProductFilters(sp);
  const data = q
    ? await searchProducts(q, params)
    : { items: [], total: 0, page: 1, perPage: params.perPage, totalPages: 0 };

  const categories = q ? [] : await listActiveCategories();

  return (
    <Container as="main" className="py-8 md:py-12">
      {q && (
        <TrackView
          type="search"
          metadata={{ query: q, resultsCount: data.total }}
        />
      )}
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-bold md:text-4xl">
          {q ? <>Results for “{q}”</> : "Search"}
        </h1>
        {q && (
          <p className="mt-2 text-muted-foreground">
            {data.total} {data.total === 1 ? "result" : "results"}
          </p>
        )}
      </header>

      {!q ? (
        <EmptyState
          icon={<SearchIcon className="size-7" />}
          title="What are you looking for?"
          message="Try searching for a product, or browse by category."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/category/${c.slug}`}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-pastel-pink/20"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          }
        />
      ) : data.items.length > 0 ? (
        <>
          <ProductGrid products={data.items} />
          <Pagination page={data.page} totalPages={data.totalPages} basePath="/search" searchParams={sp} />
        </>
      ) : (
        <EmptyState
          icon={<SearchIcon className="size-7" />}
          title={`No results for “${q}”`}
          message="Try a different word, or browse all products."
          action={
            <Link href="/products" className="rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground">
              Browse all products
            </Link>
          }
        />
      )}
    </Container>
  );
}
