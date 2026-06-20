import Link from "next/link";
import { ShieldX } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/admin/empty-state";

/**
 * 403 "no access" screen (doc 10 §4.9). `requireRole()` redirects here when an
 * authenticated admin lacks the role for an area — no redirect loop, a clear
 * message, and a link back to the dashboard. Still `requireAdmin()`s so an
 * unauthenticated hit bounces to login.
 */
export default async function NoAccessPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-md py-12">
      <EmptyState
        icon={<ShieldX className="size-6" />}
        title="You don't have access to this area"
        description="Ask the owner if you need it. Your other sections are available from the menu."
        action={
          <Button asChild>
            <Link href="/admin">Back to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
