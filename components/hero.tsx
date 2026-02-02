"use client";

import React, { Suspense } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, Heart, Gift, ArrowRight } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

// Dynamically import 3D scene for performance
const Hero3DScene = dynamic(() => import("./hero-3d-scene"), {
  ssr: false,
  loading: () => null,
});

const FloatingElement = ({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => (
  <motion.div
    initial={{ y: 0 }}
    animate={{ y: [-10, 10, -10] }}
    transition={{
      duration: 4,
      repeat: Infinity,
      delay,
      ease: "easeInOut",
    }}
    className={className}
  >
    {children}
  </motion.div>
);

// Animated sparkle particles
const SparkleParticle = ({ style }: { style: React.CSSProperties }) => (
  <motion.div
    style={style}
    className="absolute w-1 h-1 bg-[#FFE566] rounded-full"
    animate={{
      scale: [0, 1, 0],
      opacity: [0, 1, 0],
    }}
    transition={{
      duration: 2 + Math.random() * 2,
      repeat: Infinity,
      delay: Math.random() * 3,
      ease: "easeInOut",
    }}
  />
);

export function Hero() {
  // Generate random sparkle positions
  const sparkles = Array.from({ length: 20 }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
  }));

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#FFF0F5] via-[#FFF9FB] to-[#F0E6FF]">
      {/* 3D Background Scene */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={null}>
          <Hero3DScene />
        </Suspense>
      </div>

      {/* Animated Background Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large blob shapes */}
        <motion.div
          className="absolute -top-20 -left-20 w-96 h-96 bg-[#FFB3C6]/30 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 -right-20 w-80 h-80 bg-[#B8F4D0]/30 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -30, 0],
            y: [0, -50, 0],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-20 left-1/3 w-72 h-72 bg-[#FFE566]/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            x: [0, 20, 0],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#E0C6FF]/25 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            y: [0, 40, 0],
          }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Random sparkle particles */}
        {sparkles.map((pos, i) => (
          <SparkleParticle key={i} style={{ left: pos.left, top: pos.top }} />
        ))}
      </div>

      {/* Floating decorative elements - hidden on mobile to reduce clutter */}
      <FloatingElement delay={0} className="absolute top-32 left-20 hidden md:block z-10">
        <div className="w-16 h-16 bg-[#B8F4D0] rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm">
          <Gift className="w-8 h-8 text-foreground" />
        </div>
      </FloatingElement>

      <FloatingElement delay={1} className="absolute top-40 right-32 hidden md:block z-10">
        <div className="w-14 h-14 bg-[#FFE566] rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm">
          <Heart className="w-7 h-7 text-foreground" />
        </div>
      </FloatingElement>

      <FloatingElement delay={2} className="absolute bottom-32 left-20 hidden md:block z-10">
        <div className="w-10 h-10 bg-[#E0C6FF] rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm">
          <Sparkles className="w-5 h-5 text-foreground" />
        </div>
      </FloatingElement>

      <FloatingElement delay={0.5} className="absolute bottom-40 right-20 hidden md:block z-10">
        <div className="w-14 h-14 bg-[#FFCBA4] rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm">
          <span className="text-xl">✨</span>
        </div>
      </FloatingElement>

      {/* Main Content */}
      <div className="relative z-20 container mx-auto px-4 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-[#FFB3C6]/50 backdrop-blur-sm px-4 py-2 rounded-full mb-6 border border-[#FFB3C6]"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Handcrafted with Love
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold mb-6 text-balance"
          >
            <span className="text-foreground">Unique </span>
            <span className="text-primary relative">
              Handmade
              <motion.svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 300 12"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 1, duration: 1 }}
              >
                <motion.path
                  d="M0 6 Q75 0 150 6 T300 6"
                  fill="none"
                  stroke="#FFE566"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </motion.svg>
            </span>
            <br />
            <span className="text-foreground">Gifts for Every </span>
            <span className="bg-gradient-to-r from-[#FFB3C6] via-[#E0C6FF] to-[#B8F4D0] bg-clip-text text-transparent">
              Occasion
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-pretty"
          >
            Transform your special moments into cherished memories with
            personalized, handcrafted gifts made with passion and creativity by
            Vanshika Bhatia.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group"
            >
              Shop Collection
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground px-8 py-6 text-lg rounded-full transition-all duration-300 hover:scale-105 bg-transparent"
              asChild
            >
              <Link href="#custom-order">Custom Orders</Link>
            </Button>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#B8F4D0] rounded-full" />
              <span>100+ Happy Customers</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#FFE566] rounded-full" />
              <span>Handmade with Love</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#FFB3C6] rounded-full" />
              <span>Pan India Delivery</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-6 h-10 border-2 border-primary rounded-full flex justify-center pt-2"
        >
          <motion.div
            animate={{ y: [0, 12, 0], opacity: [1, 0, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1.5 h-1.5 bg-primary rounded-full"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
