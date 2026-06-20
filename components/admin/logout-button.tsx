"use client";

import { useFormStatus } from "react-dom";
import { LogOut, Loader2 } from "lucide-react";
import { logoutAction } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

/**
 * `LogoutButton` — posts the `logoutAction` Server Action (clears the session
 * cookie then redirects to `/admin-login`). Rendered in the topbar account menu
 * and the mobile drawer. Client component so it can show pending state.
 */
export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAction} className="w-full">
      <LogoutInner className={className} />
    </form>
  );
}

function LogoutInner({ className }: { className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <LogOut className="size-4" aria-hidden />
      )}
      Sign out
    </button>
  );
}
