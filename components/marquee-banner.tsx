"use client";

import { motion } from "framer-motion";
import { Sparkles, Heart, Gift, Star } from "lucide-react";

const ICONS = [Heart, Gift, Star, Sparkles];

// Default strip shown when no marquee banners are set in the admin.
const FALLBACK_ITEMS = [
  "Handmade with Love",
  "Custom Gifts",
  "Free Shipping Above ₹999",
  "100% Unique Designs",
  "Pan India Delivery",
  "Perfect for Every Occasion",
];

/**
 * Scrolling promo strip. Renders the admin's active **marquee** banners (Content
 * → Banners) when any exist, otherwise the default strip — same design either way.
 */
export function MarqueeBanner({ items }: { items?: string[] }) {
  const data = items && items.length > 0 ? items : FALLBACK_ITEMS;
  return (
    <div className="bg-gradient-to-r from-pastel-yellow via-pastel-mint to-pastel-pink py-3 overflow-hidden">
      <motion.div
        className="flex whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {/* Double the items for seamless loop */}
        {[...data, ...data].map((text, index) => {
          const Icon = ICONS[index % ICONS.length];
          return (
            <div
              key={index}
              className="flex items-center gap-2 mx-8 text-foreground font-medium"
            >
              <Icon className="w-4 h-4" />
              <span>{text}</span>
              <span className="text-primary mx-4">✦</span>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
