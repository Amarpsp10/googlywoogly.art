"use client";

import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingBag, Eye, ArrowRight, Sparkles } from "lucide-react";
import Image from "next/image";

const categories = [
  { name: "All", value: "all" },
  { name: "New Arrivals", value: "new" },
  { name: "Best Sellers", value: "bestseller" },
  { name: "Personalized", value: "personalized" },
  { name: "Seasonal", value: "seasonal" },
];

const products = [
  {
    id: 1,
    name: "Custom Portrait Frame",
    price: 799,
    originalPrice: 999,
    image: "/images/products/custom-portrait.jpg",
    category: "bestseller",
    badge: "Best Seller",
    badgeColor: "bg-[#FFE566]",
  },
  {
    id: 2,
    name: "Memory Scrapbook",
    price: 1499,
    originalPrice: 1899,
    image: "/images/products/memory-book.jpg",
    category: "bestseller",
    badge: "Popular",
    badgeColor: "bg-[#E0C6FF]",
  },
  {
    id: 3,
    name: "Luxury Gift Hamper",
    price: 1999,
    originalPrice: 2499,
    image: "/images/products/gift-hamper.jpg",
    category: "seasonal",
    badge: "Special",
    badgeColor: "bg-[#A8E6FF]",
  },
  {
    id: 4,
    name: "Resin Art Piece",
    price: 699,
    originalPrice: 899,
    image: "/images/products/resin-art.jpg",
    category: "new",
    badge: "New",
    badgeColor: "bg-[#FFB3C6]",
  },
  {
    id: 5,
    name: "Love Letter Kit",
    price: 599,
    originalPrice: 799,
    image: "/images/products/love-letter.jpg",
    category: "personalized",
    badge: "Romantic",
    badgeColor: "bg-[#FFCBA4]",
  },
  {
    id: 6,
    name: "Decorated Photo Frame",
    price: 899,
    originalPrice: 1199,
    image: "/images/products/photo-frame.jpg",
    category: "personalized",
    badge: "Customizable",
    badgeColor: "bg-[#B8F4D0]",
  },
  {
    id: 7,
    name: "Birthday Explosion Box",
    price: 1299,
    originalPrice: 1599,
    image: "/images/products/birthday-box.jpg",
    category: "new",
    badge: "Trending",
    badgeColor: "bg-[#FFE566]",
  },
  {
    id: 8,
    name: "Custom Painted Mug",
    price: 499,
    originalPrice: 699,
    image: "/images/products/custom-mug.jpg",
    category: "personalized",
    badge: "Custom",
    badgeColor: "bg-[#B8F4D0]",
  },
];

// Generate placeholder colors for products
const placeholderColors = [
  "from-pastel-pink to-pastel-lavender",
  "from-pastel-mint to-pastel-sky",
  "from-pastel-yellow to-pastel-peach",
  "from-pastel-lavender to-pastel-pink",
  "from-pastel-peach to-pastel-yellow",
  "from-pastel-sky to-pastel-mint",
  "from-pastel-pink to-pastel-mint",
  "from-pastel-yellow to-pastel-lavender",
];

export function Products() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeCategory, setActiveCategory] = useState("all");
  const [hoveredProduct, setHoveredProduct] = useState<number | null>(null);

  const filteredProducts =
    activeCategory === "all"
      ? products
      : products.filter((p) => p.category === activeCategory);

  return (
    <section id="products" className="py-16 md:py-24 bg-gradient-to-b from-background to-muted/30 relative overflow-hidden">
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
            Featured{" "}
            <span className="text-primary">Products</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Each piece is lovingly handcrafted to bring joy to your special moments
          </p>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap justify-center gap-3 mb-12"
        >
          {categories.map((category) => (
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

        {/* Products Grid */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {filteredProducts.map((product, index) => (
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
              {/* Product Image */}
              <div className="relative aspect-square overflow-hidden">
                {/* Actual Product Image */}
                <Image
                  src={product.image || "/placeholder.svg"}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />

                {/* Badge */}
                <div
                  className={`absolute top-3 left-3 ${product.badgeColor} px-3 py-1 rounded-full text-xs font-bold text-foreground shadow-md z-10`}
                >
                  {product.badge}
                </div>

                {/* Wishlist Button */}
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: hoveredProduct === product.id ? 1 : 0,
                    scale: hoveredProduct === product.id ? 1 : 0.8,
                  }}
                  className="absolute top-3 right-3 w-9 h-9 bg-background/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-primary hover:text-primary-foreground transition-colors z-10"
                >
                  <Heart className="w-4 h-4" />
                </motion.button>

                {/* Quick Actions Overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: hoveredProduct === product.id ? 1 : 0,
                  }}
                  className="absolute inset-0 bg-foreground/10 backdrop-blur-[2px] flex items-center justify-center gap-3 z-10"
                >
                  <motion.button
                    initial={{ y: 20, opacity: 0 }}
                    animate={{
                      y: hoveredProduct === product.id ? 0 : 20,
                      opacity: hoveredProduct === product.id ? 1 : 0,
                    }}
                    transition={{ delay: 0.1 }}
                    className="w-10 h-10 bg-background rounded-full flex items-center justify-center shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <Eye className="w-5 h-5" />
                  </motion.button>
                  <motion.button
                    initial={{ y: 20, opacity: 0 }}
                    animate={{
                      y: hoveredProduct === product.id ? 0 : 20,
                      opacity: hoveredProduct === product.id ? 1 : 0,
                    }}
                    transition={{ delay: 0.2 }}
                    className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
                  >
                    <ShoppingBag className="w-5 h-5" />
                  </motion.button>
                </motion.div>
              </div>

              {/* Product Info */}
              <div className="p-4">
                <h3 className="font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-primary">
                    ₹{product.price}
                  </span>
                  <span className="text-sm text-muted-foreground line-through">
                    ₹{product.originalPrice}
                  </span>
                  <span className="text-xs bg-[#B8F4D0]/50 text-foreground px-2 py-0.5 rounded-full">
                    {Math.round(
                      ((product.originalPrice - product.price) /
                        product.originalPrice) *
                        100
                    )}
                    % OFF
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
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
          >
            View All Products
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
