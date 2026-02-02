"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import { useInView } from "framer-motion";
import { Instagram, Heart, MessageCircle, ExternalLink } from "lucide-react";
import Image from "next/image";

// Simulated Instagram posts with actual images
const instagramPosts = [
  {
    id: 1,
    image: "/images/instagram/insta-1.jpg",
    likes: "234",
    comments: "12",
    caption: "Custom scrapbook work",
  },
  {
    id: 2,
    image: "/images/instagram/insta-2.jpg",
    likes: "189",
    comments: "8",
    caption: "Resin keychain collection",
  },
  {
    id: 3,
    image: "/images/instagram/insta-3.jpg",
    likes: "312",
    comments: "24",
    caption: "Explosion box reveal",
  },
  {
    id: 4,
    image: "/images/instagram/insta-4.jpg",
    likes: "267",
    comments: "15",
    caption: "Work in progress",
  },
  {
    id: 5,
    image: "/images/instagram/insta-5.jpg",
    likes: "198",
    comments: "11",
    caption: "Gift wrapping magic",
  },
  {
    id: 6,
    image: "/images/instagram/insta-6.jpg",
    likes: "245",
    comments: "18",
    caption: "Handmade cards",
  },
];

export function InstagramFeed() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Instagram className="w-4 h-4" />
            Follow Our Journey
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-foreground mb-4 text-balance">
            <span className="text-primary">@googlywoogly_arrtt</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Follow us for daily inspiration, behind-the-scenes, and exclusive offers!
          </p>
        </motion.div>

        {/* Instagram Grid */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          {instagramPosts.map((post, index) => (
            <motion.a
              key={post.id}
              href="https://www.instagram.com/googlywoogly_arrtt"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={
                isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }
              }
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer"
            >
              {/* Actual Instagram Image */}
              <Image
                src={post.image || "/placeholder.svg"}
                alt={post.caption}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 16vw"
              />

              {/* Hover Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                className="absolute inset-0 bg-foreground/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <div className="flex items-center gap-4 text-background">
                  <div className="flex items-center gap-1">
                    <Heart className="w-5 h-5 fill-current" />
                    <span className="font-medium">{post.likes}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-5 h-5" />
                    <span className="font-medium">{post.comments}</span>
                  </div>
                </div>
              </motion.div>

              {/* Instagram Icon */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-8 h-8 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <ExternalLink className="w-4 h-4 text-foreground" />
                </div>
              </div>
            </motion.a>
          ))}
        </motion.div>

        {/* Follow CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <motion.a
            href="https://www.instagram.com/googlywoogly_arrtt"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white px-8 py-4 rounded-full font-medium shadow-lg"
          >
            <Instagram className="w-5 h-5" />
            Follow @googlywoogly_arrtt
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
