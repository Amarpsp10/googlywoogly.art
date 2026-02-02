"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import { useInView } from "framer-motion";
import { Heart, Palette, Award, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const stats = [
  { icon: Users, value: "100+", label: "Happy Customers" },
  { icon: Heart, value: "500+", label: "Gifts Delivered" },
  { icon: Palette, value: "50+", label: "Unique Designs" },
  { icon: Award, value: "5★", label: "Customer Rating" },
];

export function About() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="about"
      className="py-16 md:py-24 bg-gradient-to-br from-[#FFB3C6]/10 via-background to-[#E0C6FF]/10 overflow-hidden relative"
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute top-20 left-10 w-72 h-72 bg-[#FFB3C6]/15 rounded-full blur-3xl"
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-80 h-80 bg-[#E0C6FF]/15 rounded-full blur-3xl"
          animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#FFE566]/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Image Section */}
          <motion.div
            ref={ref}
            initial={{ opacity: 0, x: -50 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            {/* Main Image Container */}
            <div className="relative">
              {/* Decorative Elements */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -top-8 -left-8 w-32 h-32 border-4 border-dashed border-[#FFE566] rounded-full"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute -bottom-8 -right-8 w-40 h-40 border-4 border-dashed border-[#B8F4D0] rounded-full"
              />

              {/* Artist Image */}
              <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl">
                <div className="aspect-[4/5] relative">
                  <Image
                    src="/images/artist-vanshika.jpg"
                    alt="Vanshika Bhatia - Artist and Creator of GooglyWoogly Art"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                  />
                  {/* Name Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/80 to-transparent p-6">
                    <h3 className="text-2xl font-serif font-bold text-background mb-1">
                      Vanshika Bhatia
                    </h3>
                    <p className="text-background/80">Artist & Creator</p>
                  </div>
                </div>
              </div>

              {/* Floating Cards */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={
                  isInView
                    ? { opacity: 1, scale: 1 }
                    : { opacity: 0, scale: 0.8 }
                }
                transition={{ delay: 0.3 }}
                className="absolute -right-4 top-1/4 bg-card p-4 rounded-xl shadow-lg border border-border z-20"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FFE566] rounded-full flex items-center justify-center">
                    <Heart className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">500+</p>
                    <p className="text-xs text-muted-foreground">
                      Gifts Crafted
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={
                  isInView
                    ? { opacity: 1, scale: 1 }
                    : { opacity: 0, scale: 0.8 }
                }
                transition={{ delay: 0.5 }}
                className="absolute -left-4 bottom-1/4 bg-card p-4 rounded-xl shadow-lg border border-border z-20"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#B8F4D0] rounded-full flex items-center justify-center">
                    <Award className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">5.0 ★</p>
                    <p className="text-xs text-muted-foreground">Rating</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Content Section */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <span className="inline-block bg-[#E0C6FF]/50 text-foreground px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              Meet the Artist
            </span>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-foreground mb-6 text-balance">
              Hi, I'm{" "}
              <span className="text-primary">Vanshika Bhatia</span>
            </h2>

            <div className="space-y-4 text-muted-foreground text-lg mb-8">
              <p>
                Welcome to <strong className="text-foreground">GooglyWoogly Art</strong> – where creativity meets heartfelt gifting! I'm a passionate artist who believes that every gift should tell a story and create lasting memories.
              </p>
              <p>
                What started as a hobby has blossomed into a dream of spreading joy through handcrafted gifts. Each piece I create is infused with love, attention to detail, and a personal touch that makes it uniquely yours.
              </p>
              <p>
                Whether it's a birthday, anniversary, or just because – I'm here to help you express your love in the most creative way possible.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={
                    isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                  }
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="text-center p-4 bg-card rounded-xl border border-border"
                >
                  <stat.icon className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Social Links */}
            <div className="flex flex-wrap gap-4">
              <motion.a
                href="https://www.instagram.com/googlywoogly_arrtt"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white px-6 py-3 rounded-full font-medium shadow-lg"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
                Follow on Instagram
              </motion.a>

              <motion.a
                href="https://linktr.ee/Vanshika__1425"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 bg-[#B8F4D0] text-foreground px-6 py-3 rounded-full font-medium shadow-lg"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M7.953 15.066c-.08.163-.08.324-.08.486.08 1.461.962 2.678 2.192 3.247.406.163.893.244 1.38.244.324 0 .648-.041.973-.122 1.054-.244 1.95-.813 2.519-1.624.324-.406.487-.893.487-1.461 0-.163-.041-.324-.081-.486l-7.39-.284zm3.327-14.066c-6.627 0-11.28 4.653-11.28 10.28 0 2.356.812 4.549 2.192 6.336l-2.192 4.653 4.816-2.029c1.705.893 3.654 1.38 5.464 1.38 6.627 0 11.28-4.653 11.28-10.28 0-5.628-4.653-10.34-10.28-10.34z" />
                </svg>
                All Links
              </motion.a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
