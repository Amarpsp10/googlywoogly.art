import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Eyebrow + serif title used across storefront sections, matching the homepage style. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  link,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  link?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-10",
        align === "center" ? "text-center" : "flex flex-wrap items-end justify-between gap-4",
        className,
      )}
    >
      <div className={align === "center" ? "mx-auto max-w-2xl" : "max-w-2xl"}>
        {eyebrow && (
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/50 px-4 py-1.5 text-sm font-medium text-foreground">
            <Sparkles className="size-4" />
            {eyebrow}
          </span>
        )}
        <h2 className="font-serif text-3xl font-bold text-balance md:text-4xl lg:text-5xl">
          {title}
        </h2>
        {description && (
          <p className="mt-3 text-lg text-muted-foreground text-pretty">{description}</p>
        )}
      </div>
      {link && align === "left" && (
        <Link
          href={link.href}
          className="group inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          {link.label}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}
