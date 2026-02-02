"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import { useInView } from "framer-motion";
import {
  MessageCircle,
  Palette,
  Package,
  Truck,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

const steps = [
  {
    icon: MessageCircle,
    title: "Share Your Vision",
    description: "Tell us your gift idea and occasion details",
    color: "#FFB3C6",
  },
  {
    icon: Palette,
    title: "Design & Create",
    description: "We bring your vision to life with love",
    color: "#FFE566",
  },
  {
    icon: Package,
    title: "Quality Check",
    description: "Every piece is carefully inspected",
    color: "#B8F4D0",
  },
  {
    icon: Truck,
    title: "Safe Delivery",
    description: "Beautifully packaged to your doorstep",
    color: "#E0C6FF",
  },
];

// Arrow component for between steps
const StepArrow = ({ delay }: { delay: number }) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.5 }}
    className="hidden md:flex items-center justify-center px-2"
  >
    <motion.div
      animate={{ x: [0, 5, 0] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      className="relative"
    >
      {/* Arrow body */}
      <div className="flex items-center">
        <div className="w-8 lg:w-12 h-0.5 bg-gradient-to-r from-[#FFB3C6] via-[#FFE566] to-[#B8F4D0]" />
        <ChevronRight className="w-6 h-6 text-primary -ml-1" />
      </div>
    </motion.div>
  </motion.div>
);

// Mobile arrow (vertical)
const MobileArrow = ({ delay }: { delay: number }) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.5 }}
    className="flex md:hidden justify-center py-3"
  >
    <motion.div
      animate={{ y: [0, 5, 0] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      className="flex flex-col items-center"
    >
      <div className="w-0.5 h-6 bg-gradient-to-b from-[#FFB3C6] to-[#B8F4D0]" />
      <svg
        width="16"
        height="10"
        viewBox="0 0 16 10"
        className="text-primary -mt-0.5"
      >
        <path
          d="M1 1L8 8L15 1"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </motion.div>
  </motion.div>
);

export function Process() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="process"
      className="py-16 md:py-24 bg-gradient-to-b from-muted/30 to-background overflow-hidden relative"
    >
      {/* Background animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FFE566]/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 md:mb-16"
        >
          <span className="inline-block bg-[#FFCBA4]/50 text-foreground px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            How It Works
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-foreground mb-4 text-balance">
            From Idea to <span className="text-primary">Delivery</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Creating your perfect gift is a journey we take together
          </p>
        </motion.div>

        {/* Process Steps */}
        <div ref={ref} className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-center">
            {steps.map((step, index) => (
              <div key={step.title} className="flex flex-col md:flex-row items-center">
                {/* Step Card */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={
                    isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }
                  }
                  transition={{ delay: index * 0.2, duration: 0.5 }}
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="relative group"
                >
                  <div className="flex flex-col items-center text-center p-4 md:p-6">
                    {/* Step Number Badge */}
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="relative mb-4"
                    >
                      {/* Glow effect */}
                      <motion.div
                        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{
                          background: step.color,
                          filter: "blur(20px)",
                        }}
                      />
                      
                      {/* Icon container */}
                      <div
                        className="relative w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center shadow-lg"
                        style={{ backgroundColor: step.color }}
                      >
                        <step.icon className="w-10 h-10 md:w-12 md:h-12 text-foreground" />
                        
                        {/* Step number */}
                        <span 
                          className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-md"
                          style={{ 
                            backgroundColor: step.color,
                            border: '3px solid white'
                          }}
                        >
                          {index + 1}
                        </span>
                      </div>
                    </motion.div>

                    {/* Content */}
                    <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-[180px]">
                      {step.description}
                    </p>
                  </div>
                </motion.div>

                {/* Arrow between steps */}
                {index < steps.length - 1 && (
                  <>
                    <StepArrow delay={index * 0.2 + 0.3} />
                    <MobileArrow delay={index * 0.2 + 0.3} />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="text-center mt-12 md:mt-16"
        >
          <motion.a
            href="#contact"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-3 bg-primary text-primary-foreground px-8 py-4 rounded-full font-medium shadow-lg text-lg group"
          >
            Start Your Order
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
