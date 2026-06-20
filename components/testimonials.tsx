"use client";

import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

/** A testimonial in display shape (DB rows are normalised into this). */
interface DisplayTestimonial {
  id: string;
  name: string;
  location: string;
  rating: number;
  text: string;
  product?: string;
  avatar: string;
  color: string;
}

const COLORS = ["#FFB3C6", "#B8F4D0", "#FFE566", "#E0C6FF", "#FFCBA4", "#A8E6FF"];

/** Default testimonials shown until the founder adds approved/featured ones. */
const FALLBACK: DisplayTestimonial[] = [
  { id: "f1", name: "Priya Sharma", location: "Mumbai", rating: 5, text: "Absolutely loved the personalized gift I ordered for my husband's birthday! The attention to detail was incredible.", product: "Custom Portrait Frame", avatar: "PS", color: "#FFB3C6" },
  { id: "f2", name: "Rahul Verma", location: "Delhi", rating: 5, text: "The scrapbook I got for my girlfriend was simply beautiful! She was in tears of joy. Thank you!", product: "Memory Scrapbook", avatar: "RV", color: "#B8F4D0" },
  { id: "f3", name: "Ananya Patel", location: "Bangalore", rating: 5, text: "Fast delivery, excellent quality, and the packaging was so pretty! Perfect for my friend's wedding.", product: "Personalized Gift Box", avatar: "AP", color: "#FFE566" },
  { id: "f4", name: "Vikram Singh", location: "Pune", rating: 5, text: "I've ordered multiple times and the quality has been consistently amazing. Highly recommended!", product: "Customized Wall Art", avatar: "VS", color: "#E0C6FF" },
  { id: "f5", name: "Sneha Gupta", location: "Jaipur", rating: 5, text: "The birthday hamper was beautifully curated. The personalized touch made all the difference.", product: "Birthday Hamper", avatar: "SG", color: "#FFCBA4" },
  { id: "f6", name: "Arjun Reddy", location: "Hyderabad", rating: 5, text: "Exceptional work! The coasters I ordered were stunning. Everyone at the party loved them!", product: "Hand-painted Coasters", avatar: "AR", color: "#A8E6FF" },
];

/** Two-letter initials for the avatar bubble. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** A real (admin-managed) testimonial row from the DB. */
export interface TestimonialInput {
  id: string;
  customerName: string;
  location: string | null;
  rating: number | null;
  text: string;
}

// Testimonial Card Component
const TestimonialCard = ({ testimonial }: { testimonial: DisplayTestimonial }) => (
  <div
    className="flex-shrink-0 w-[320px] md:w-[380px] bg-card rounded-2xl p-6 shadow-lg border border-border/50 mx-3 hover:shadow-xl transition-shadow duration-300"
    style={{ background: `linear-gradient(135deg, white, ${testimonial.color}10)` }}
  >
    {/* Quote Icon */}
    <Quote className="w-8 h-8 mb-4" style={{ color: `${testimonial.color}80` }} />

    {/* Rating */}
    <div className="flex gap-1 mb-3">
      {[...Array(testimonial.rating)].map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-[#FFE566] text-[#FFE566]" />
      ))}
    </div>

    {/* Review Text */}
    <p className="text-foreground/80 mb-5 leading-relaxed text-sm md:text-base">
      &quot;{testimonial.text}&quot;
    </p>

    {/* Customer Info */}
    <div className="flex items-center gap-3">
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-foreground font-bold text-sm"
        style={{ backgroundColor: testimonial.color }}
      >
        {testimonial.avatar}
      </div>
      <div>
        <h4 className="font-bold text-foreground text-sm">{testimonial.name}</h4>
        <p className="text-xs text-muted-foreground">
          {[testimonial.location, testimonial.product].filter(Boolean).join(" • ")}
        </p>
      </div>
    </div>
  </div>
);

/**
 * Testimonials carousel. Renders the admin's approved + featured testimonials
 * (Content → Testimonials) when any exist, otherwise a default set — same design.
 */
export function Testimonials({ items }: { items?: TestimonialInput[] }) {
  const data: DisplayTestimonial[] =
    items && items.length > 0
      ? items.map((t, i) => ({
          id: t.id,
          name: t.customerName,
          location: t.location ?? "",
          rating: t.rating ?? 5,
          text: t.text,
          avatar: initials(t.customerName),
          color: COLORS[i % COLORS.length],
        }))
      : FALLBACK;

  const doubled = [...data, ...data];
  const shift = 50 * data.length * 6.5;

  return (
    <section
      id="testimonials"
      className="py-16 md:py-24 bg-gradient-to-br from-[#FFE566]/10 via-background to-[#B8F4D0]/10 overflow-hidden relative"
    >
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-20 -left-20 w-80 h-80 bg-[#FFB3C6]/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], x: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-20 -right-20 w-96 h-96 bg-[#B8F4D0]/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.3, 1], x: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 px-4"
        >
          <span className="inline-block bg-[#A8E6FF]/50 text-foreground px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            Customer Love
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-foreground mb-4 text-balance">
            What Our <span className="text-primary">Customers Say</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Real stories from happy customers who loved their gifts
          </p>
        </motion.div>

        {/* Infinite Scrolling Testimonials - Row 1 (Right to Left) */}
        <div className="relative mb-6 overflow-x-hidden py-4">
          <motion.div
            className="flex"
            animate={{ x: [0, -shift] }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          >
            {doubled.map((testimonial, index) => (
              <TestimonialCard key={`row1-${testimonial.id}-${index}`} testimonial={testimonial} />
            ))}
          </motion.div>

          {/* Gradient overlays for smooth edges */}
          <div className="absolute inset-y-0 left-0 w-20 md:w-40 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
          <div className="absolute inset-y-0 right-0 w-20 md:w-40 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
        </div>

        {/* Infinite Scrolling Testimonials - Row 2 (Left to Right) */}
        <div className="relative overflow-x-hidden py-4">
          <motion.div
            className="flex"
            initial={{ x: -shift }}
            animate={{ x: 0 }}
            transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
          >
            {[...doubled].reverse().map((testimonial, index) => (
              <TestimonialCard key={`row2-${testimonial.id}-${index}`} testimonial={testimonial} />
            ))}
          </motion.div>

          {/* Gradient overlays for smooth edges */}
          <div className="absolute inset-y-0 left-0 w-20 md:w-40 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
          <div className="absolute inset-y-0 right-0 w-20 md:w-40 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
        </div>

        {/* Trust Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12 px-4"
        >
          <div className="inline-flex items-center gap-4 bg-card px-6 py-4 rounded-full shadow-lg border border-border">
            <div className="flex -space-x-3">
              {["#FFB3C6", "#B8F4D0", "#FFE566", "#E0C6FF"].map((color, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full border-2 border-card flex items-center justify-center text-xs font-bold text-foreground"
                  style={{ backgroundColor: color }}
                >
                  {["PS", "RV", "AP", "VS"][i]}
                </div>
              ))}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#FFE566] text-[#FFE566]" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">100+</strong> Happy Customers
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
