"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Menu,
  X,
  ShoppingBag,
  Instagram,
  Phone,
} from "lucide-react";
import Link from "next/link";

const navLinks = [
  { name: "Home", href: "#home" },
  { name: "Shop", href: "/products" },
  { name: "About", href: "#about" },
  { name: "Process", href: "#process" },
  { name: "Testimonials", href: "#testimonials" },
  { name: "Contact", href: "#contact" },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-background/90 backdrop-blur-lg shadow-lg"
            : "bg-transparent"
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link href="#home" className="flex items-center gap-2">
              <motion.div
                whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5 }}
                className="text-2xl md:text-3xl font-serif font-bold"
              >
                <span className="text-primary">Googly</span>
                <span className="text-foreground">Woogly</span>
                <span className="text-pastel-yellow">.</span>
                <span className="text-pastel-mint">Art</span>
              </motion.div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link, index) => (
                <motion.div
                  key={link.name}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link
                    href={link.href}
                    className="text-foreground/80 hover:text-primary transition-colors relative group font-medium"
                  >
                    {link.name}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              <motion.a
                href="https://www.instagram.com/googlywoogly_arrtt"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="hidden sm:flex w-10 h-10 rounded-full bg-pastel-pink/30 items-center justify-center hover:bg-pastel-pink/50 transition-colors"
              >
                <Instagram className="w-5 h-5 text-primary" />
              </motion.a>

              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="hidden sm:flex w-10 h-10 rounded-full bg-pastel-mint/30 items-center justify-center hover:bg-pastel-mint/50 transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-5 h-5 text-foreground" />
              </motion.div>

              <Button
                size="sm"
                className="hidden md:inline-flex bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6"
                asChild
              >
                <Link href="#contact">
                  <Phone className="w-4 h-4 mr-2" />
                  Order Now
                </Link>
              </Button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full bg-pastel-pink/30 hover:bg-pastel-pink/50 transition-colors"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5 text-foreground" />
                ) : (
                  <Menu className="w-5 h-5 text-foreground" />
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            <div
              className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-background shadow-2xl"
            >
              <div className="flex flex-col h-full pt-20 pb-8 px-6">
                <div className="flex flex-col gap-4">
                  {navLinks.map((link, index) => (
                    <motion.div
                      key={link.name}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="text-xl font-medium text-foreground hover:text-primary transition-colors py-2 block"
                      >
                        {link.name}
                      </Link>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-auto space-y-4">
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full"
                    asChild
                  >
                    <Link href="#contact">Order Now</Link>
                  </Button>

                  <div className="flex justify-center gap-4">
                    <a
                      href="https://www.instagram.com/googlywoogly_arrtt"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-12 h-12 rounded-full bg-pastel-pink/30 flex items-center justify-center hover:bg-pastel-pink/50 transition-colors"
                    >
                      <Instagram className="w-6 h-6 text-primary" />
                    </a>
                    <div className="w-12 h-12 rounded-full bg-pastel-mint/30 flex items-center justify-center hover:bg-pastel-mint/50 transition-colors cursor-pointer">
                      <ShoppingBag className="w-6 h-6 text-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
