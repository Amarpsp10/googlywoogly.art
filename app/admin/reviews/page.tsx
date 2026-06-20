import type { Metadata } from "next";
import { ReviewStatus } from "@prisma/client";
import { Star, CheckCircle2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { adminListReviews, ADMIN_REVIEWS_PAGE_SIZE } from "@/lib/admin/crm";
import { REVIEW_STATUS } from "@/lib/constants";
import { formatDateTimeIST } from "@/lib/format";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { Toolbar } from "@/components/admin/toolbar";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { StatusFilterSelect } from "@/components/admin/crm/status-filter-select";
import { ReviewCard, type ReviewCardData } from "./review-card";

export const metadata: Metadata = { title: "Reviews" };

const STATUS_OPTIONS = Object.entries(REVIEW_STATUS).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

/** Default the queue to `pending`; allow ?status= to switch (incl. "" = all). */
function parseStatus(value: string | undefined): ReviewStatus | undefined {
  if (value === undefined) return ReviewStatus.pending; // default queue
  return value in ReviewStatus
    ? ReviewStatus[value as keyof typeof ReviewStatus]
    : undefined;
}

function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1;
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Reviews are an owner/admin surface (doc 10 §5.4 — staff ⛔).
  await requireRole(["owner", "admin"]);
  const sp = await searchParams;

  const statusParam = typeof sp.status === "string" ? sp.status : undefined;
  const status = parseStatus(statusParam);
  const page = parsePage(typeof sp.page === "string" ? sp.page : undefined);

  const { items, total, totalPages } = await adminListReviews({
    status,
    page,
    pageSize: ADMIN_REVIEWS_PAGE_SIZE,
  });

  const cards: ReviewCardData[] = items.map((r) => ({
    id: r.id,
    productTitle: r.productTitle,
    productSlug: r.productSlug,
    customerName: r.customerName,
    rating: r.rating,
    title: r.title,
    body: r.body,
    status: r.status,
    isVerifiedPurchase: r.isVerifiedPurchase,
    createdAtLabel: formatDateTimeIST(r.createdAt),
  }));

  const filterLabel = status ? REVIEW_STATUS[status].label : "All";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Reviews"
        description="Moderate product reviews before they appear on the storefront."
      />

      <Panel
        bodyClassName="space-y-4"
        title="Moderation queue"
        description={`${total} ${total === 1 ? "review" : "reviews"} · ${filterLabel}`}
      >
        <Toolbar>
          <StatusFilterSelect
            options={STATUS_OPTIONS}
            allLabel="All statuses"
            ariaLabel="Filter by review status"
          />
        </Toolbar>

        {cards.length === 0 ? (
          <EmptyState
            icon={
              status === ReviewStatus.pending ? (
                <CheckCircle2 className="size-6" />
              ) : (
                <Star className="size-6" />
              )
            }
            title={
              status === ReviewStatus.pending
                ? "Nothing to moderate"
                : "No reviews here"
            }
            description={
              status === ReviewStatus.pending
                ? "You're all caught up — new reviews will appear here for approval."
                : "There are no reviews with this status yet."
            }
          />
        ) : (
          <>
            <div className="space-y-3">
              {cards.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>

            <AdminPagination
              page={page}
              totalPages={totalPages}
              total={total}
              basePath="/admin/reviews"
              searchParams={sp}
            />
          </>
        )}
      </Panel>
    </div>
  );
}
