import React from "react"
import type { Metadata, Viewport } from "next";
import { Quicksand, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

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
  title: "GooglyWoogly Art | Handmade Gifts with Love by Vanshika Bhatia",
  description:
    "Discover unique handmade personalized gifts crafted with love. Custom artwork, personalized presents, and creative gift solutions for every occasion. Shop GooglyWoogly Art by Vanshika Bhatia.",
  keywords: [
    "handmade gifts",
    "personalized gifts",
    "custom artwork",
    "handcrafted presents",
    "unique gifts",
    "Vanshika Bhatia",
    "GooglyWoogly Art",
    "creative gifts",
    "artisan gifts",
    "gift ideas",
  ],
  authors: [{ name: "Vanshika Bhatia" }],
  creator: "Vanshika Bhatia",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://googlywoogly.art",
    siteName: "GooglyWoogly Art",
    title: "GooglyWoogly Art | Handmade Gifts with Love",
    description:
      "Discover unique handmade personalized gifts crafted with love by Vanshika Bhatia.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "GooglyWoogly Art - Handmade Gifts with Love",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GooglyWoogly Art | Handmade Gifts with Love",
    description:
      "Discover unique handmade personalized gifts crafted with love.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
    generator: 'v0.app'
};

export const viewport: Viewport = {
  themeColor: "#FF8FAB",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${quicksand.variable} ${playfair.variable}`}>
      <body className="font-sans antialiased overflow-x-hidden">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
