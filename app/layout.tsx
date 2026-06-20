import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Quicksand, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import "./globals.css";
import { publicEnv } from "@/lib/env";

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: "GooglyWoogly Art | Handmade Gifts & Décor from Jaipur",
    template: "%s · GooglyWoogly Art",
  },
  description:
    "Discover unique handmade personalized gifts and home décor, crafted with love in Jaipur by Vanshika Bhatia. Each piece is one of a kind.",
  keywords: [
    "handmade gifts",
    "personalized gifts",
    "home décor",
    "Jaipur",
    "handcrafted",
    "GooglyWoogly Art",
  ],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "GooglyWoogly Art",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "GooglyWoogly Art" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.jpg"] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#FF8FAB",
  width: "device-width",
  initialScale: 1,
};

/**
 * Root layout — minimal global shell only (html, fonts, toaster, analytics).
 * The storefront chrome lives in `app/(shop)/layout.tsx`; the admin chrome in
 * `app/admin/layout.tsx`. This keeps each surface's framing independent.
 */
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${quicksand.variable} ${playfair.variable}`}>
      <body className="overflow-x-hidden font-sans antialiased">
        {children}
        <Toaster richColors position="top-center" />
        <Analytics />
      </body>
    </html>
  );
}
