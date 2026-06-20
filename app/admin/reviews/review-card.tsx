"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Star, Check, X, BadgeCheck } from "lucide-react";
import { ReviewStatus } from "@prisma/client";
import { moderateReview } from "./actions";
import { REVIEW_STATUS } from "@/lib/constants";
import type { ActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/status-badge";

/**
 * A single review in the moderation queue (client leaf). Renders the quote +
 * product link, and — for a `pending` review — Approve / Reject buttons that
 * post `moderateReview`. Decided reviews show their status badge (read-only).
 * Surfaces the `ActionResult` as a toast.
 */

const initial: ActionResult<void> = { ok: false, error: "" };

export interface ReviewCardData {
  id: string;
  productTitle: string;
  productSlug: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  createdAtLabel: string;
}

function Stars({ rating }: { rating: number }) {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${clamped} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "size-3.5",
            i < clamped ? "fill-primary text-primary" : "text-muted-foreground/40",
          )}
          aria-hidden
        />
      ))}
    </span>
  );
}

export function ReviewCard({ review }: { review: ReviewCardData }) {
  const [state, action] = useActionState(moderateReview, initial);

  useEffect(() => {
    if (state.ok) toast.success("Review moderated.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  const meta = REVIEW_STATUS[review.status];
  const isPending = review.status === ReviewStatus.pending;

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Stars rating={review.rating} />
            <span className="font-medium text-foreground">{review.customerName}</span>
            {review.isVerifiedPurchase ? (
              <span className="inline-flex items-center gap-1 text-xs text-secondary-foreground">
                <BadgeCheck className="size-3.5" aria-hidden />
                Verified
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            on{" "}
            <a
              href={`/products/${review.productSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-primary hover:underline"
            >
              {review.productTitle}
            </a>{" "}
            · {review.createdAtLabel}
          </p>
        </div>
        {!isPending ? <StatusBadge tone={meta.tone} label={meta.label} /> : null}
      </div>

      {review.title ? (
        <p className="mt-3 font-medium text-foreground">{review.title}</p>
      ) : null}
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{review.body}</p>

      {isPending ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={action}>
            <input type="hidden" name="id" value={review.id} />
            <input type="hidden" name="decision" value={ReviewStatus.approved} />
            <Button type="submit" variant="secondary" size="sm">
              <Check className="size-4" />
              Approve
            </Button>
          </form>
          <form action={action}>
            <input type="hidden" name="id" value={review.id} />
            <input type="hidden" name="decision" value={ReviewStatus.rejected} />
            <Button type="submit" variant="outline" size="sm">
              <X className="size-4" />
              Reject
            </Button>
          </form>
        </div>
      ) : null}
    </article>
  );
}
