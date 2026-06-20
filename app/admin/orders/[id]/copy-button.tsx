"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Copy-to-clipboard button (courier label, tracking number, track link). Confirms
 * with a brief icon swap + toast (accessible: `aria-live` on the visual state, a
 * discernible `aria-label`). Falls back gracefully if the clipboard API is absent.
 */
export function CopyButton({
  value,
  label = "Copy",
  iconOnly = false,
  className,
}: {
  value: string;
  label?: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard.");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy. Copy it manually.");
    }
  }

  const Icon = copied ? Check : Copy;

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        iconOnly && "size-7 justify-center px-0",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <span aria-live="polite" className={cn(iconOnly && "sr-only")}>
        {copied ? "Copied" : label}
      </span>
    </button>
  );
}
