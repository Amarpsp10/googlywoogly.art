"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HomeHero({
  headline = "Handmade with heart, in Jaipur",
  sub = "One-of-a-kind gifts & home décor, crafted by hand and made to be treasured.",
  ctaLabel = "Shop the collection",
  ctaHref = "/products",
}: {
  headline?: string;
  sub?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#FFF0F5] via-background to-muted">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="animate-float absolute -left-24 -top-24 size-96 rounded-full bg-pastel-pink/30 blur-3xl" />
        <div className="animate-float-reverse absolute -right-16 top-1/3 size-80 rounded-full bg-pastel-mint/30 blur-3xl" />
        <div className="animate-float absolute bottom-0 left-1/3 size-72 rounded-full bg-pastel-yellow/20 blur-3xl" />
      </div>

      <div className="container relative mx-auto px-4 py-24 text-center md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mx-auto max-w-3xl"
        >
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#FFB3C6] bg-[#FFB3C6]/40 px-4 py-2 text-sm font-medium">
            <Sparkles className="size-4 text-primary" />
            Handcrafted with love
          </span>
          <h1 className="font-serif text-4xl font-bold text-balance md:text-6xl lg:text-7xl">
            {headline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-pretty md:text-xl">
            {sub}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="group rounded-full px-8 py-6 text-lg">
              <Link href={ctaHref}>
                {ctaLabel}
                <ArrowRight className="ml-2 size-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-2 border-primary px-8 py-6 text-lg text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Link href="/bulk-orders">Bulk &amp; Corporate</Link>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-pastel-mint" /> 100+ happy customers
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-pastel-yellow" /> Handmade with love
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-pastel-pink" /> Pan-India delivery
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
