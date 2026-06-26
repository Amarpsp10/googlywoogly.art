"use client";

// The Cloudinary Video Player ships its own stylesheet. In the App Router the
// player's internal `next/head` <link> is dropped, so we import the packaged CSS
// directly (bundled only with this lazily-loaded module — see product-gallery).
import "next-cloudinary/dist/cld-video-player.css";

import * as React from "react";
import { CldVideoPlayer } from "next-cloudinary";
import { Play } from "lucide-react";
import {
  publicIdFromUrl,
  cloudNameFromUrl,
  videoPosterUrl,
} from "@/lib/cloudinary-shared";
import { cn } from "@/lib/utils";

/**
 * `ProductVideo` — a thin, performance-first wrapper around next-cloudinary's
 * `CldVideoPlayer` for the PDP gallery.
 *
 * PERF: the heavy player (videojs + the Cloudinary plugin) is **poster-gated and
 * lazy** — we render only a cheap poster frame until the user clicks it OR it
 * scrolls into view (IntersectionObserver). Delivery is **progressive MP4** (no
 * HLS/adaptive manifest), `q_auto` + a ~1080px width cap, `muted` + `playsInline`
 * so it can autoplay on selection. Like `SmartImage`, the cloud name is parsed
 * from the stored URL and passed via `config` so rendering never depends on the
 * build-time `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (the `ml_default` 404 trap).
 *
 * Non-Cloudinary video URLs (seed/external) fall back to a native `<video>`.
 */
export function ProductVideo({
  src,
  alt,
  poster,
  width,
  height,
  className,
}: {
  src: string;
  alt?: string | null;
  poster?: string | null;
  width?: number;
  height?: number;
  className?: string;
}) {
  const publicId = publicIdFromUrl(src);
  const cloudName = cloudNameFromUrl(src);

  const [clicked, setClicked] = React.useState(false);
  const [inView, setInView] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Lazy gate: mark in-view once (then disconnect) so the player can mount.
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const posterUrl = poster ?? videoPosterUrl(src) ?? undefined;

  // Non-Cloudinary source: a plain lazy <video>, no heavy player.
  if (!publicId) {
    return (
      <video
        src={src}
        poster={posterUrl}
        controls
        playsInline
        preload="none"
        aria-label={alt ?? "Product video"}
        className={cn("absolute inset-0 size-full bg-black object-contain", className)}
      />
    );
  }

  const config = cloudName ? { cloud: { cloudName } } : undefined;
  const shouldMount = clicked || inView;

  return (
    <div ref={containerRef} className={cn("absolute inset-0 size-full", className)}>
      {shouldMount ? (
        <div className="absolute inset-0 flex size-full items-center justify-center bg-black [&_.video-js]:!w-full [&_video]:!w-full">
          <CldVideoPlayer
            src={publicId}
            config={config}
            width={width ?? 1080}
            height={height ?? 1080}
            poster={posterUrl}
            controls
            muted
            autoplay
            playsinline
            loop={false}
            sourceTypes={["mp4"]}
            transformation={{ quality: "auto", width: 1080, crop: "limit" }}
            className="w-full"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setClicked(true)}
          aria-label={alt ? `Play video: ${alt}` : "Play video"}
          className="group absolute inset-0 size-full bg-black"
        >
          {posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={posterUrl} alt={alt ?? ""} className="size-full object-cover" />
          ) : null}
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform group-hover:scale-110">
              <Play className="size-7 translate-x-0.5 fill-current" aria-hidden />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
