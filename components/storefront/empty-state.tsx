import type { ReactNode } from "react";
import { PackageOpen } from "lucide-react";

export function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-pastel-pink/30 text-primary">
        {icon ?? <PackageOpen className="size-7" />}
      </div>
      <h3 className="font-serif text-xl font-bold">{title}</h3>
      {message && <p className="mt-2 max-w-md text-muted-foreground">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
