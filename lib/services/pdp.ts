import "server-only";
import { prisma } from "@/lib/db";
import { getProductBySlug, type ProductCardWithState, type ProductDetailWithState } from "./catalog";
import { productCardSelect } from "./select";
import { deriveInventoryState } from "@/lib/inventory";

/**
 * Product detail page data: the product plus a "you may also like" rail.
 * Recommendations here are a lean same-category query (in-stock / bestsellers
 * first); the richer co-occurrence ranker is a V1 upgrade.
 */
export async function getProductPageData(
  slug: string,
): Promise<{ product: ProductDetailWithState; related: ProductCardWithState[] } | null> {
  const product = await getProductBySlug(slug);
  if (!product) return null;

  const seed = await prisma.product.findUnique({
    where: { id: product.id },
    select: { categoryId: true },
  });

  const rows = await prisma.product.findMany({
    where: {
      status: "active",
      publishedAt: { lte: new Date() },
      id: { not: product.id },
      ...(seed?.categoryId ? { categoryId: seed.categoryId } : {}),
    },
    select: productCardSelect,
    orderBy: [
      { isBestseller: "desc" },
      { publishedAt: { sort: "desc", nulls: "last" } },
      { id: "asc" },
    ],
    take: 8,
  });

  const related = rows.map((r) => ({ ...r, inventoryState: deriveInventoryState(r) }));
  return { product, related };
}
