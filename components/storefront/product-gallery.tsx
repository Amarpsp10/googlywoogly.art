"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Play } from "lucide-react";
import { SmartImage } from "./smart-image";
import { videoPosterUrl } from "@/lib/cloudinary-shared";
import { cn } from "@/lib/utils";

// The Cloudinary video player (videojs) + its stylesheet are heavy, so load the
// wrapper only when a product actually has a video selected — it stays out of the
// PDP's initial JS/CSS and is fetched on demand (ssr:false; it's interaction-only).
const ProductVideo = dynamic(
  () => import("./product-video").then((m) => m.ProductVideo),
  { ssr: false },
);

interface GalleryImage {
  url: string;
  alt?: string | null;
  /** `video` items render the lazy player; everything else is an image. */
  mediaType?: "image" | "video";
  width?: number | null;
  height?: number | null;
}

export function ProductGallery({
  images,
  title,
}: {
  images: GalleryImage[];
  title: string;
}) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return <div className="aspect-square w-full rounded-2xl bg-muted" />;
  }
  const main = images[Math.min(active, images.length - 1)];
  const mainIsVideo = main.mediaType === "video";

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted">
        {mainIsVideo ? (
          <ProductVideo
            // Remount on switch so the player state never leaks between clips.
            key={main.url}
            src={main.url}
            alt={main.alt ?? title}
            width={main.width ?? undefined}
            height={main.height ?? undefined}
          />
        ) : (
          <SmartImage
            src={main.url}
            alt={main.alt ?? title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        )}
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((img, i) => {
            const isVideo = img.mediaType === "video";
            const poster = isVideo ? videoPosterUrl(img.url) : null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-xl bg-muted ring-2 transition",
                  i === active ? "ring-primary" : "ring-transparent hover:ring-border",
                )}
                aria-label={
                  isVideo
                    ? `Play video ${i + 1} of ${images.length}`
                    : `View image ${i + 1} of ${images.length}`
                }
              >
                {isVideo ? (
                  <>
                    {poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={poster} alt="" className="size-full object-cover" />
                    ) : null}
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="flex size-7 items-center justify-center rounded-full bg-black/55 text-white">
                        <Play className="size-3.5 translate-x-px fill-current" aria-hidden />
                      </span>
                    </span>
                  </>
                ) : (
                  <SmartImage src={img.url} alt="" fill sizes="120px" className="object-cover" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
