"use client";

import { motion } from "framer-motion";
import { Sparkles, Heart, Gift, Star } from "lucide-react";

const marqueeItems = [
  { text: "Handmade with Love", icon: Heart },
  { text: "Custom Gifts", icon: Gift },
  { text: "Free Shipping Above ₹999", icon: Star },
  { text: "100% Unique Designs", icon: Sparkles },
  { text: "Pan India Delivery", icon: Gift },
  { text: "Perfect for Every Occasion", icon: Heart },
];

export function MarqueeBanner() {
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
        {[...marqueeItems, ...marqueeItems].map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-2 mx-8 text-foreground font-medium"
          >
            <item.icon className="w-4 h-4" />
            <span>{item.text}</span>
            <span className="text-primary mx-4">✦</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
