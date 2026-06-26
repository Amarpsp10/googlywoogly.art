import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductPageData } from "@/lib/services/pdp";
import { getProductBySlug, getAllActiveProductSlugs } from "@/lib/services/catalog";
import { getSiteSettings } from "@/lib/services/settings";
import { Container } from "@/components/storefront/container";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { PriceDisplay } from "@/components/storefront/price";
import { InventoryBadge } from "@/components/storefront/inventory-badge";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductGrid } from "@/components/storefront/product-grid";
import { SectionHeading } from "@/components/storefront/section-heading";
import { PdpBuyPanel } from "@/components/storefront/pdp-buy-panel";
import { buildMetadata, absoluteUrl } from "@/lib/seo/metadata";
import { JsonLd, productLd, breadcrumbLd } from "@/lib/seo/jsonld";
import { TrackView } from "@/components/analytics/track-view";
import { Truck, RefreshCw, Sparkles } from "lucide-react";
import type { AddToCartProduct } from "@/lib/cart/types";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllActiveProductSlugs();
  return slugs.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return buildMetadata({
    title: product.metaTitle ?? product.title,
    description: product.metaDescription ?? product.shortDescription ?? undefined,
    path: `/products/${product.slug}`,
    images: product.primaryImage
      ? [{ url: product.primaryImage.url, alt: product.title }]
      : undefined,
  });
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getProductPageData(slug);
  if (!data) notFound();
  const { product, related } = data;
  const settings = await getSiteSettings();

  const addToCart: AddToCartProduct = {
    id: product.id,
    slug: product.slug,
    title: product.title,
    sku: product.sku,
    price: product.price,
    imageUrl: product.primaryImage?.url,
    madeToOrder: product.madeToOrder,
    inventoryQuantity: product.inventoryQuantity,
    lowStockThreshold: product.lowStockThreshold,
    allowsPersonalization: product.allowsPersonalization,
  };

  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/products" },
    ...(product.category
      ? [{ label: product.category.name, href: `/category/${product.category.slug}` }]
      : []),
    { label: product.title },
  ];

  return (
    <Container as="main" className="py-8 md:py-12">
      <TrackView type="product_view" productId={product.id} />
      <Breadcrumbs items={crumbs} />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery
          images={product.images.map((i) => ({
            url: i.url,
            alt: i.alt,
            mediaType: i.type === "video" ? "video" : "image",
            width: i.width,
            height: i.height,
          }))}
          title={product.title}
        />

        <div className="flex flex-col">
          {product.subtitle && (
            <span className="mb-1 text-sm font-medium text-primary">{product.subtitle}</span>
          )}
          <h1 className="font-serif text-3xl font-bold text-balance md:text-4xl">
            {product.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <PriceDisplay
              price={product.price}
              compareAtPrice={product.compareAtPrice}
              size="lg"
            />
            <InventoryBadge
              state={product.inventoryState}
              leadTimeDays={product.productionLeadTimeDays}
            />
          </div>

          {product.shortDescription && (
            <p className="mt-4 text-muted-foreground text-pretty">{product.shortDescription}</p>
          )}

          <div className="mt-6">
            <PdpBuyPanel
              product={addToCart}
              personalizationLabel={product.personalizationLabel}
              whatsappNumber={settings?.whatsappNumber ?? ""}
              productUrl={absoluteUrl(`/products/${product.slug}`)}
            />
          </div>

          {/* Trust strip */}
          <div className="mt-6 grid grid-cols-1 gap-3 rounded-2xl bg-muted/50 p-4 text-sm sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> Handmade in Jaipur
            </div>
            <div className="flex items-center gap-2">
              <Truck className="size-4 text-primary" /> Pan-India delivery
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw className="size-4 text-primary" /> Easy 7-day returns*
            </div>
          </div>

          {/* Details */}
          {product.description && (
            <div
              className="prose prose-sm mt-8 max-w-none text-foreground/90"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          )}
          <dl className="mt-6 space-y-2 text-sm">
            {product.materials && (
              <div className="flex gap-2">
                <dt className="font-medium">Materials:</dt>
                <dd className="text-muted-foreground">{product.materials}</dd>
              </div>
            )}
            {product.careInstructions && (
              <div className="flex gap-2">
                <dt className="font-medium">Care:</dt>
                <dd className="text-muted-foreground">{product.careInstructions}</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            *Ready-made items only — personalised &amp; made-to-order pieces are final sale.
            Each piece is handmade, so slight variations are natural.
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16 md:mt-24">
          <SectionHeading eyebrow="You may also like" title="More handmade favourites" />
          <ProductGrid products={related} priorityCount={0} />
        </section>
      )}

      <JsonLd
        data={productLd({
          title: product.title,
          slug: product.slug,
          sku: product.sku,
          description: product.shortDescription,
          price: product.price,
          // Product schema images are stills only — never advertise a video as an image.
          imageUrls: product.images.filter((i) => i.type !== "video").map((i) => i.url),
          inventoryState: product.inventoryState,
        })}
      />
      <JsonLd data={breadcrumbLd(crumbs.filter((c) => c.href).map((c) => ({ name: c.label, path: c.href! })))} />
    </Container>
  );
}
