"use client";

import { useState } from "react";
import { SmartImage } from "./smart-image";
import { cn } from "@/lib/utils";

interface GalleryImage {
  url: string;
  alt?: string | null;
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

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted">
        <SmartImage
          src={main.url}
          alt={main.alt ?? title}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl bg-muted ring-2 transition",
                i === active ? "ring-primary" : "ring-transparent hover:ring-border",
              )}
              aria-label={`View image ${i + 1} of ${images.length}`}
            >
              <SmartImage src={img.url} alt="" fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
