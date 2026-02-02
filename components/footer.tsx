"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Heart, Instagram, Mail, Phone, MapPin, ArrowUp } from "lucide-react";

const footerLinks = {
  quickLinks: [
    { name: "Home", href: "#home" },
    { name: "Products", href: "#products" },
    { name: "About", href: "#about" },
    { name: "Process", href: "#process" },
    { name: "Testimonials", href: "#testimonials" },
    { name: "Contact", href: "#contact" },
  ],
  categories: [
    { name: "Custom Frames", href: "#products" },
    { name: "Gift Boxes", href: "#products" },
    { name: "Scrapbooks", href: "#products" },
    { name: "Wall Art", href: "#products" },
    { name: "Personalized Gifts", href: "#products" },
    { name: "Birthday Hampers", href: "#products" },
  ],
  support: [
    { name: "FAQs", href: "#faq" },
    { name: "Shipping Info", href: "#faq" },
    { name: "Order Tracking", href: "#contact" },
    { name: "Returns", href: "#faq" },
    { name: "Custom Orders", href: "#contact" },
  ],
};

const socialLinks = [
  {
    name: "Instagram",
    icon: Instagram,
    href: "https://www.instagram.com/googlywoogly_arrtt",
    color: "hover:bg-gradient-to-r hover:from-[#833AB4] hover:via-[#FD1D1D] hover:to-[#F77737] hover:text-white",
  },
  {
    name: "WhatsApp",
    icon: () => (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
    href: "https://wa.me/916367851899",
    color: "hover:bg-[#25D366] hover:text-white",
  },
  {
    name: "Email",
    icon: Mail,
    href: "mailto:Vanshikabhatia25007@gmail.com",
    color: "hover:bg-primary hover:text-primary-foreground",
  },
];

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="bg-foreground text-background relative overflow-hidden">
      {/* Decorative top wave */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-pastel-mint/20 to-transparent" />

      {/* Main Footer Content */}
      <div className="container mx-auto px-4 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link href="#home" className="inline-block mb-4">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="text-3xl font-serif font-bold"
              >
                <span className="text-pastel-pink">Googly</span>
                <span className="text-background">Woogly</span>
                <span className="text-pastel-yellow">.</span>
                <span className="text-pastel-mint">Art</span>
              </motion.div>
            </Link>
            <p className="text-background/70 mb-6 max-w-sm">
              Handcrafted gifts made with love by Vanshika Bhatia. Every piece
              tells a story and creates lasting memories.
            </p>

            {/* Social Links */}
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={`w-10 h-10 bg-background/10 rounded-full flex items-center justify-center transition-all ${social.color}`}
                >
                  {typeof social.icon === "function" ? (
                    <social.icon />
                  ) : (
                    <social.icon className="w-5 h-5" />
                  )}
                </motion.a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-lg mb-4 text-background">Quick Links</h4>
            <ul className="space-y-3">
              {footerLinks.quickLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-background/70 hover:text-pastel-pink transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-bold text-lg mb-4 text-background">Categories</h4>
            <ul className="space-y-3">
              {footerLinks.categories.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-background/70 hover:text-pastel-mint transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-bold text-lg mb-4 text-background">Contact</h4>
            <ul className="space-y-4">
              <li>
                <a
                  href="tel:+916367851899"
                  className="flex items-center gap-3 text-background/70 hover:text-pastel-yellow transition-colors"
                >
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <span>+91 63678 51899</span>
                </a>
              </li>
              <li>
                <a
                  href="mailto:Vanshikabhatia25007@gmail.com"
                  className="flex items-center gap-3 text-background/70 hover:text-pastel-yellow transition-colors"
                >
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span className="break-all">Vanshikabhatia25007@gmail.com</span>
                </a>
              </li>
              <li>
                <div className="flex items-start gap-3 text-background/70">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-1" />
                  <span>India - Pan India Delivery</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter */}
        <div className="bg-background/5 rounded-2xl p-6 md:p-8 mb-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h4 className="font-bold text-xl text-background mb-2">
                Stay Updated!
              </h4>
              <p className="text-background/70">
                Follow us on Instagram for new designs, offers, and creative inspiration.
              </p>
            </div>
            <motion.a
              href="https://www.instagram.com/googlywoogly_arrtt"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white px-6 py-3 rounded-full font-medium shadow-lg whitespace-nowrap"
            >
              <Instagram className="w-5 h-5" />
              Follow @googlywoogly_arrtt
            </motion.a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-background/10 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-background/60 text-sm text-center md:text-left">
              © {new Date().getFullYear()} GooglyWoogly Art by Vanshika Bhatia.
              All rights reserved.
            </p>
            <p className="text-background/60 text-sm flex items-center gap-1">
              Made with{" "}
              <Heart className="w-4 h-4 text-pastel-pink fill-pastel-pink" /> in
              India
            </p>
          </div>
        </div>
      </div>

      {/* Back to Top Button */}
      <motion.button
        onClick={scrollToTop}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center z-50 hover:bg-primary/90 transition-colors"
      >
        <ArrowUp className="w-5 h-5" />
      </motion.button>
    </footer>
  );
}
