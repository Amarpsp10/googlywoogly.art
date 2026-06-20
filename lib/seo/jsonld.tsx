import { absoluteUrl, SITE_NAME } from "./metadata";
import { paiseToRupees } from "@/lib/money";
import type { InventoryState } from "@/lib/inventory";

/** Renders a JSON-LD script tag. Server component. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function organizationLd(opts: { logoUrl?: string; sameAs?: string[] }): object {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: opts.logoUrl ? absoluteUrl(opts.logoUrl) : undefined,
    sameAs: opts.sameAs?.length ? opts.sameAs : undefined,
  };
}

export function websiteLd(): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/search")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

function availabilityUrl(state: InventoryState): string {
  switch (state) {
    case "out_of_stock":
      return "https://schema.org/OutOfStock";
    case "made_to_order":
      return "https://schema.org/PreOrder";
    default:
      return "https://schema.org/InStock";
  }
}

export function productLd(p: {
  title: string;
  slug: string;
  sku: string;
  description?: string | null;
  price: number;
  imageUrls: string[];
  inventoryState: InventoryState;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    sku: p.sku,
    description: p.description ?? undefined,
    image: p.imageUrls.map((u) => absoluteUrl(u)),
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/products/${p.slug}`),
      priceCurrency: "INR",
      price: paiseToRupees(p.price).toFixed(2),
      availability: availabilityUrl(p.inventoryState),
      seller: { "@type": "Organization", name: SITE_NAME },
    },
  };
}

export function itemListLd(items: { name: string; path: string }[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: absoluteUrl(it.path),
    })),
  };
}
