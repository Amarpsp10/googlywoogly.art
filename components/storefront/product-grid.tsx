import { ProductCard } from "./product-card";
import type { ProductCardWithState } from "@/lib/services/catalog";

export function ProductGrid({
  products,
  priorityCount = 4,
}: {
  products: ProductCardWithState[];
  priorityCount?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} priority={i < priorityCount} />
      ))}
    </div>
  );
}
