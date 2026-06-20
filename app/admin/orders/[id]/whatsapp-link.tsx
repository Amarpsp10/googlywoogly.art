"use client";

import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A founder → buyer WhatsApp deep-link (docs/12 FR-14). Opens `wa.me` in a new
 * tab so the founder taps to send a prefilled message manually. Styled as a small
 * inline pill; `rel="noopener noreferrer"` for safe external navigation.
 */
export function WhatsAppLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2.5 py-0.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary",
        className,
      )}
    >
      <MessageCircle className="size-3.5" aria-hidden />
      {children}
    </a>
  );
}
