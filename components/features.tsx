"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import { useInView } from "framer-motion";
import {
  Heart,
  Truck,
  MessageCircleHeart,
  ShieldCheck,
  Palette,
  Clock,
} from "lucide-react";

const features = [
  {
    icon: Heart,
    title: "Made with Love",
    color: "#FFB3C6",
  },
  {
    icon: Truck,
    title: "Pan India Delivery",
    color: "#B8F4D0",
  },
  {
    icon: MessageCircleHeart,
    title: "100+ Happy Customers",
    color: "#FFE566",
  },
  {
    icon: ShieldCheck,
    title: "Quality Assured",
    color: "#E0C6FF",
  },
  {
    icon: Palette,
    title: "Custom Designs",
    color: "#FFCBA4",
  },
  {
    icon: Clock,
    title: "Timely Delivery",
    color: "#A8E6FF",
  },
];

export function Features() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section className="py-12 md:py-16 bg-background relative overflow-hidden">
      {/* Background animated gradient */}
      <div className="absolute inset-0 opacity-30">
        <motion.div
          className="absolute top-0 left-1/4 w-96 h-96 bg-[#FFB3C6]/20 rounded-full blur-3xl"
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 w-80 h-80 bg-[#B8F4D0]/20 rounded-full blur-3xl"
          animate={{
            x: [0, -30, 0],
            y: [0, -20, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <span className="inline-block bg-[#B8F4D0]/50 text-foreground px-4 py-1.5 rounded-full text-sm font-medium mb-3">
            Why Choose Us
          </span>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold text-foreground text-balance">
            What Makes Us <span className="text-primary">Special</span>
          </h2>
        </motion.div>

        {/* Horizontal scrolling feature strip */}
        <div ref={ref} className="relative">
          {/* Desktop: Single row with animated hover */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            className="flex flex-wrap justify-center gap-4 md:gap-6"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={
                  isInView
                    ? { opacity: 1, scale: 1 }
                    : { opacity: 0, scale: 0.8 }
                }
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="group relative"
              >
                <div
                  className="flex items-center gap-3 px-5 py-3 rounded-full border-2 transition-all duration-300 cursor-pointer backdrop-blur-sm"
                  style={{
                    borderColor: feature.color,
                    background: `linear-gradient(135deg, ${feature.color}20, ${feature.color}10)`,
                  }}
                >
                  {/* Animated icon container */}
                  <motion.div
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                    className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: feature.color }}
                  >
                    <feature.icon className="w-5 h-5 text-foreground" />
                  </motion.div>

                  <span className="font-semibold text-foreground text-sm md:text-base whitespace-nowrap">
                    {feature.title}
                  </span>

                  {/* Hover glow effect */}
                  <motion.div
                    className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
                    style={{
                      background: `radial-gradient(circle, ${feature.color}40 0%, transparent 70%)`,
                      filter: "blur(10px)",
                    }}
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Decorative connecting line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent -z-10" />
        </div>
      </div>
    </section>
  );
}
