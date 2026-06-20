import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/admin/panel";

/**
 * Orders list loading skeleton (docs/12 FR-24). Mirrors the page shell — header,
 * toolbar, and a handful of table rows — so the founder never sees a blank screen
 * (CANON §2 CWV).
 */
export default function OrdersLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Skeleton className="h-10 w-full sm:max-w-xs" />
        <Skeleton className="h-10 w-full sm:w-48" />
        <Skeleton className="h-10 w-full sm:w-48" />
      </div>
      <Panel bodyClassName="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </Panel>
    </div>
  );
}
