"use client";

import Image from "next/image";
import { CldImage } from "next-cloudinary";
import { publicIdFromUrl, cloudNameFromUrl } from "@/lib/cloudinary-shared";

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
  const cloudName = cloudNameFromUrl(src);

  if (publicId) {
    // Tell CldImage the cloud name parsed from the stored URL rather than relying
    // on NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME (if that build-time env var is unset in
    // an environment, next-cloudinary silently uses its `ml_default` demo cloud
    // and 404s every image). `config` is undefined → falls back to the env default.
    const config = cloudName ? { cloud: { cloudName } } : undefined;
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
        config={config}
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
        config={config}
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
