import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/admin/panel";

/**
 * Order detail loading skeleton (docs/12 FR-24). Two-column layout placeholder
 * matching the real detail so the transition is calm on the founder's phone.
 */
export default function OrderDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Panel key={i} bodyClassName="space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </Panel>
          ))}
        </div>
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <Panel key={i} bodyClassName="space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-10 w-full" />
            </Panel>
          ))}
        </div>
      </div>
    </div>
  );
}
