import type { Metadata } from "next";
import { publicEnv } from "@/lib/env";

export const SITE_NAME = "GooglyWoogly Art";

/** Resolve a path or relative URL to an absolute URL using the public site URL. */
export function absoluteUrl(path = "/"): string {
  const base = publicEnv.siteUrl.replace(/\/$/, "");
  if (path.startsWith("http")) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Build page Metadata with canonical + OpenGraph + Twitter, consistently. */
export function buildMetadata(opts: {
  title?: string;
  description?: string;
  path?: string;
  images?: { url: string; alt?: string }[];
  noindex?: boolean;
}): Metadata {
  const { title, description, path = "/", images, noindex } = opts;
  const canonical = absoluteUrl(path);
  const ogImages = images?.map((i) => ({ url: absoluteUrl(i.url), alt: i.alt }));
  return {
    title,
    description,
    alternates: { canonical },
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      url: canonical,
      siteName: SITE_NAME,
      title: title ?? undefined,
      description: description ?? undefined,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: title ?? undefined,
      description: description ?? undefined,
      images: ogImages?.map((i) => i.url),
    },
  };
}
