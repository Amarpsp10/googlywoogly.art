import Image from "next/image";
import Link from "next/link";
import { PriceDisplay } from "./price";
import { InventoryBadge } from "./inventory-badge";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import type { ProductCardWithState } from "@/lib/services/catalog";
import type { AddToCartProduct } from "@/lib/cart/types";

function toAddToCart(p: ProductCardWithState): AddToCartProduct {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    sku: p.sku,
    price: p.price,
    imageUrl: p.primaryImage?.url,
    madeToOrder: p.madeToOrder,
    inventoryQuantity: p.inventoryQuantity,
    lowStockThreshold: p.lowStockThreshold,
    allowsPersonalization: p.allowsPersonalization,
  };
}

/** Storefront product card (RSC). Hover effects are pure CSS; the only client
 *  island is the AddToCartButton. */
export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductCardWithState;
  priority?: boolean;
}) {
  const href = `/products/${product.slug}`;
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <Link
        href={href}
        aria-label={product.title}
        className="relative block aspect-square overflow-hidden bg-muted"
      >
        {product.primaryImage && (
          <Image
            src={product.primaryImage.url}
            alt={product.primaryImage.alt?.trim() || product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
        )}
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {product.isBestseller && (
            <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground shadow-md">
              Bestseller
            </span>
          )}
          {product.inventoryState !== "in_stock" && (
            <InventoryBadge
              state={product.inventoryState}
              leadTimeDays={product.productionLeadTimeDays}
            />
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {product.category && (
          <span className="text-xs text-muted-foreground">{product.category.name}</span>
        )}
        <Link
          href={href}
          className="line-clamp-2 font-semibold leading-snug transition-colors hover:text-primary"
        >
          {product.title}
        </Link>
        <PriceDisplay
          price={product.price}
          compareAtPrice={product.compareAtPrice}
          className="mt-auto pt-1"
        />
        <AddToCartButton
          product={toAddToCart(product)}
          size="sm"
          className="mt-2 w-full"
        />
      </div>
    </div>
  );
}
