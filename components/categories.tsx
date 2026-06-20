"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import { useInView } from "framer-motion";
import { Sparkles, Gift, Heart, Star, PartyPopper, Cake, Palette } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CategoryListItem } from "@/lib/services/select";

// Decorative palette (design, not data) — cycled by position so each real
// category keeps the original card's icon-badge + gradient look.
const ICONS = [Cake, Heart, Star, PartyPopper, Gift, Sparkles, Palette];
const COLORS = [
  "from-[#FFB3C6] to-[#E0C6FF]",
  "from-[#FFE566] to-[#FFCBA4]",
  "from-[#B8F4D0] to-[#A8E6FF]",
  "from-[#E0C6FF] to-[#FFB3C6]",
];

export function Categories({ categories }: { categories: CategoryListItem[] }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  if (categories.length === 0) return null;

  return (
    <section className="py-12 md:py-16 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          ref={ref}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
        >
          {categories.map((category, index) => {
            const Icon = ICONS[index % ICONS.length];
            const color = COLORS[index % COLORS.length];
            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5, scale: 1.02 }}
              >
                <Link
                  href={`/category/${category.slug}`}
                  className="relative group cursor-pointer rounded-2xl overflow-hidden aspect-square md:aspect-[4/5] border border-border/50 block"
                >
                  {/* Background Image */}
                  {category.image ? (
                    <Image
                      src={category.image.url}
                      alt={category.image.alt ?? category.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${color}`} />
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />

                  {/* Content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-end p-4 md:p-6 text-center">
                    <motion.div
                      whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                      transition={{ duration: 0.5 }}
                      className={`w-12 h-12 md:w-14 md:h-14 mb-3 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shadow-lg`}
                    >
                      <Icon className="w-6 h-6 md:w-7 md:h-7 text-foreground" />
                    </motion.div>

                    <h3 className="font-bold text-background mb-1 text-sm md:text-base">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="text-xs md:text-sm text-background/80 line-clamp-2">
                        {category.description}
                      </p>
                    )}

                    {/* Shop Now Text */}
                    <span className="mt-2 text-xs font-medium text-[#FFE566] opacity-0 group-hover:opacity-100 transition-opacity">
                      Shop Now →
                    </span>
                  </div>

                  {/* Decorative sparkle */}
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute top-3 right-3 z-10"
                  >
                    <Sparkles className="w-4 h-4 text-[#FFE566]" />
                  </motion.div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
