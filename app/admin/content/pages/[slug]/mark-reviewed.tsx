"use client";

import { useTransition } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markCmsPageReviewed } from "../../_actions/pages";

/**
 * `MarkReviewedButton` — stamps `lastReviewedAt = now` on a legal page (doc 15
 * FR-37 governance gate). Disabled until the page row exists (you must save it
 * once first). Toasts on completion; the page re-renders via revalidation.
 */
export function MarkReviewedButton({ id }: { id?: string }) {
  const [pending, startTransition] = useTransition();

  if (!id) {
    return (
      <Button type="button" variant="outline" size="sm" disabled className="min-h-9">
        <ShieldCheck className="size-4" aria-hidden />
        Mark as reviewed
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="min-h-9"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await markCmsPageReviewed(id);
          if (res.ok) toast.success("Marked as reviewed.");
          else toast.error(res.error || "Couldn't update. Try again.");
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
      Mark as reviewed
    </Button>
  );
}
