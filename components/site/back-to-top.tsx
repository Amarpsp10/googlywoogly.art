"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className={cn(
        "fixed bottom-6 left-6 z-40 flex size-11 items-center justify-center rounded-full bg-pastel-pink text-foreground shadow-lg transition-all duration-300 hover:scale-110",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-10 opacity-0",
      )}
    >
      <ArrowUp className="size-5" />
    </button>
  );
}
