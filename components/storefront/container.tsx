import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Centered max-width page container matching the existing layout rhythm. */
export function Container({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "main";
}) {
  return (
    <Tag className={cn("container mx-auto px-4", className)}>{children}</Tag>
  );
}
