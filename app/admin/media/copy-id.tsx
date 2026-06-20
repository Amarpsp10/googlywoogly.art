"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * `CopyId` — copies a MediaAsset id to the clipboard so the founder can paste it
 * into the image-id fields on the content editors (MVP, before a visual picker).
 */
export function CopyId({ id, className }: { id: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — no-op (the id is visible in the label).
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted",
        className,
      )}
      aria-label={copied ? "Copied id" : "Copy media id"}
    >
      {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy ID"}
    </button>
  );
}
