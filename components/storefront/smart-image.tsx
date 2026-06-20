"use client";

import Image from "next/image";
import { CldImage } from "next-cloudinary";
import { publicIdFromUrl } from "@/lib/cloudinary-shared";

/**
 * `SmartImage` — render Cloudinary-hosted images through `<CldImage>` so delivery
 * is optimized on Cloudinary's CDN (auto format + auto quality + responsive
 * widths, on the free tier), and everything else (seed/Picsum/external URLs)
 * through plain `next/image`. Drop-in for `next/image`'s `fill` and sized usages.
 *
 * Routing optimization to Cloudinary keeps image transforms OFF the metered
 * Vercel optimizer (zero-cost posture) for real product photos, which are the
 * only Cloudinary-hosted images in the catalog.
 */
interface SmartImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
}

export function SmartImage({
  src,
  alt,
  fill,
  width,
  height,
  sizes,
  priority,
  className,
}: SmartImageProps) {
  const publicId = publicIdFromUrl(src);

  if (publicId) {
    // CldImage applies f_auto + q_auto by default; the loader emits a Cloudinary
    // srcset so each viewport gets a right-sized image straight from the CDN.
    return fill ? (
      <CldImage
        src={publicId}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={className}
      />
    ) : (
      <CldImage
        src={publicId}
        alt={alt}
        width={width ?? 800}
        height={height ?? 800}
        sizes={sizes}
        priority={priority}
        className={className}
      />
    );
  }

  return fill ? (
    <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={className} />
  ) : (
    <Image
      src={src}
      alt={alt}
      width={width ?? 800}
      height={height ?? 800}
      sizes={sizes}
      priority={priority}
      className={className}
    />
  );
}
