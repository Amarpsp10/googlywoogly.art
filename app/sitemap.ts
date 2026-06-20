import type { MetadataRoute } from "next";
import {
  getAllActiveProductSlugs,
  getAllActiveCategorySlugs,
  getAllActiveCollectionSlugs,
} from "@/lib/services/catalog";
import { absoluteUrl } from "@/lib/seo/metadata";

const STATIC_ROUTES = [
  "/",
  "/products",
  "/bulk-orders",
  "/about",
  "/contact",
  "/faq",
  "/shipping-policy",
  "/returns-and-refunds",
  "/privacy-policy",
  "/terms",
  "/care-guide",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, collections] = await Promise.all([
    getAllActiveProductSlugs(),
    getAllActiveCategorySlugs(),
    getAllActiveCollectionSlugs(),
  ]);

  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));

  return [
    ...staticEntries,
    ...products.map((s) => ({
      url: absoluteUrl(`/products/${s.slug}`),
      lastModified: s.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...categories.map((s) => ({
      url: absoluteUrl(`/category/${s.slug}`),
      lastModified: s.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...collections.map((s) => ({
      url: absoluteUrl(`/collections/${s.slug}`),
      lastModified: s.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
