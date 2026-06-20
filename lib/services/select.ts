import { Prisma } from "@prisma/client";

/**
 * Shared Prisma `select` objects. Storefront/public reads MUST use these so that
 * admin-only fields (notably `costPrice`) never leak to the client, and so every
 * surface shapes products identically.
 */

export const productCardSelect = {
  id: true,
  slug: true,
  sku: true,
  title: true,
  subtitle: true,
  shortDescription: true,
  price: true,
  compareAtPrice: true,
  status: true,
  inventoryQuantity: true,
  madeToOrder: true,
  productionLeadTimeDays: true,
  lowStockThreshold: true,
  allowsPersonalization: true,
  isFeatured: true,
  isBestseller: true,
  primaryImage: { select: { url: true, alt: true, width: true, height: true } },
  category: { select: { slug: true, name: true } },
} satisfies Prisma.ProductSelect;

export const productDetailSelect = {
  ...productCardSelect,
  sku: true,
  description: true,
  materials: true,
  careInstructions: true,
  dimensions: true,
  weightGrams: true,
  personalizationLabel: true,
  tags: true,
  occasions: true,
  metaTitle: true,
  metaDescription: true,
  publishedAt: true,
  images: {
    select: { url: true, alt: true, width: true, height: true, sortOrder: true, isPrimary: true },
    orderBy: { sortOrder: "asc" },
  },
} satisfies Prisma.ProductSelect;

export const categorySelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  sortOrder: true,
  image: { select: { url: true, alt: true } },
} satisfies Prisma.CategorySelect;

export const collectionSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  sortOrder: true,
  isFeaturedOnHome: true,
  heroImage: { select: { url: true, alt: true, width: true, height: true } },
} satisfies Prisma.CollectionSelect;

export type ProductCard = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;
export type ProductDetail = Prisma.ProductGetPayload<{ select: typeof productDetailSelect }>;
export type CategoryListItem = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;
export type CollectionListItem = Prisma.CollectionGetPayload<{ select: typeof collectionSelect }>;
