"use client";

import { motion } from "framer-motion";
import { useRef, useState, useMemo } from "react";
import { useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingBag, Eye, ArrowRight, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatPaise, discountPercent } from "@/lib/money";
import type { ProductCardWithState } from "@/lib/services/catalog";

// Placeholder gradients (design, not data) for products without a photo.
const PLACEHOLDER_GRADIENTS = [
  "from-[#FFB3C6] to-[#E0C6FF]",
  "from-[#B8F4D0] to-[#A8E6FF]",
  "from-[#FFE566] to-[#FFCBA4]",
  "from-[#E0C6FF] to-[#FFB3C6]",
];

/** A small accent badge derived from real product flags (keeps the original look). */
function productBadge(p: ProductCardWithState): { label: string; color: string } | null {
  if (p.isBestseller) return { label: "Best Seller", color: "bg-[#FFE566]" };
  if (p.isFeatured) return { label: "Featured", color: "bg-[#E0C6FF]" };
  if (p.allowsPersonalization) return { label: "Personalized", color: "bg-[#B8F4D0]" };
  return null;
}

export function Products({ products }: { products: ProductCardWithState[] }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeCategory, setActiveCategory] = useState("all");
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);

  // Filter tabs come from the categories actually present (data-driven; no empty tabs).
  const tabs = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of products) if (p.category) seen.set(p.category.slug, p.category.name);
    return [
      { name: "All", value: "all" },
      ...[...seen].map(([value, name]) => ({ name, value })),
    ];
  }, [products]);

  const filteredProducts =
    activeCategory === "all"
      ? products
      : products.filter((p) => p.category?.slug === activeCategory);

  if (products.length === 0) return null;

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-background to-muted/30 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-20 right-1/4 w-80 h-80 bg-[#FFE566]/10 rounded-full blur-3xl"
          animate={{ y: [0, 30, 0], x: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#B8F4D0]/10 rounded-full blur-3xl"
          animate={{ y: [0, -30, 0], x: [0, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 bg-[#FFE566]/50 text-foreground px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Our Collection
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-foreground mb-4 text-balance">
            Featured <span className="text-primary">Products</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Each piece is lovingly handcrafted to bring joy to your special moments
          </p>
        </motion.div>

        {/* Category Filter */}
        {tabs.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-3 mb-12"
          >
            {tabs.map((category) => (
              <button
                key={category.value}
                onClick={() => setActiveCategory(category.value)}
                className={`px-5 py-2 rounded-full font-medium transition-all duration-300 ${
                  activeCategory === category.value
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-card text-foreground hover:bg-[#FFB3C6]/30 border border-border"
                }`}
              >
                {category.name}
              </button>
            ))}
          </motion.div>
        )}

        {/* Products Grid */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {filteredProducts.map((product, index) => {
            const badge = productBadge(product);
            const off = discountPercent(product.price, product.compareAtPrice);
            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                onHoverStart={() => setHoveredProduct(product.id)}
                onHoverEnd={() => setHoveredProduct(null)}
                className="group relative bg-card rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-border/50"
              >
                <Link href={`/products/${product.slug}`} className="block">
                  {/* Product Image */}
                  <div className="relative aspect-square overflow-hidden">
                    {product.primaryImage ? (
                      <Image
                        src={product.primaryImage.url}
                        alt={product.primaryImage.alt ?? product.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${
                          PLACEHOLDER_GRADIENTS[index % PLACEHOLDER_GRADIENTS.length]
                        }`}
                      />
                    )}

                    {/* Badge */}
                    {badge && (
                      <div
                        className={`absolute top-3 left-3 ${badge.color} px-3 py-1 rounded-full text-xs font-bold text-foreground shadow-md z-10`}
                      >
                        {badge.label}
                      </div>
                    )}

                    {/* Wishlist Button (decorative) */}
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{
                        opacity: hoveredProduct === product.id ? 1 : 0,
                        scale: hoveredProduct === product.id ? 1 : 0.8,
                      }}
                      className="absolute top-3 right-3 w-9 h-9 bg-background/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md z-10"
                    >
                      <Heart className="w-4 h-4" />
                    </motion.span>

                    {/* Quick Actions Overlay (decorative) */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: hoveredProduct === product.id ? 1 : 0 }}
                      className="absolute inset-0 bg-foreground/10 backdrop-blur-[2px] flex items-center justify-center gap-3 z-10"
                    >
                      <motion.span
                        initial={{ y: 20, opacity: 0 }}
                        animate={{
                          y: hoveredProduct === product.id ? 0 : 20,
                          opacity: hoveredProduct === product.id ? 1 : 0,
                        }}
                        transition={{ delay: 0.1 }}
                        className="w-10 h-10 bg-background rounded-full flex items-center justify-center shadow-lg"
                      >
                        <Eye className="w-5 h-5" />
                      </motion.span>
                      <motion.span
                        initial={{ y: 20, opacity: 0 }}
                        animate={{
                          y: hoveredProduct === product.id ? 0 : 20,
                          opacity: hoveredProduct === product.id ? 1 : 0,
                        }}
                        transition={{ delay: 0.2 }}
                        className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg"
                      >
                        <ShoppingBag className="w-5 h-5" />
                      </motion.span>
                    </motion.div>
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-1">
                      {product.title}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-bold text-primary">
                        {formatPaise(product.price)}
                      </span>
                      {product.compareAtPrice && off > 0 && (
                        <>
                          <span className="text-sm text-muted-foreground line-through">
                            {formatPaise(product.compareAtPrice)}
                          </span>
                          <span className="text-xs bg-[#B8F4D0]/50 text-foreground px-2 py-0.5 rounded-full">
                            {off}% OFF
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        {/* View All Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Button
            size="lg"
            variant="outline"
            className="border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-full px-8 group bg-transparent"
            asChild
          >
            <Link href="/products">
              View All Products
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
