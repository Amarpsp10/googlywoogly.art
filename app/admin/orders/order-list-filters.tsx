"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OrderStatus, PaymentStatus } from "@prisma/client";

import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants";
import { AdminSelect } from "@/components/admin/form-field";

/**
 * Status + payment filter selects for the orders list (docs/12 FR-21). URL-driven
 * like `SearchInput`: each select writes its param (`status` / `payment`),
 * preserves the others, and resets `page` to 1. RSC list page re-queries from the
 * URL — no client fetch. Native `<select>`s keep this accessible and form-free.
 */
export function OrderListFilters({
  status,
  paymentStatus,
}: {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="sr-only" htmlFor="order-status-filter">
        Filter by status
      </label>
      <AdminSelect
        id="order-status-filter"
        value={status ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
        className="sm:w-48"
        aria-label="Filter by status"
      >
        <option value="">All statuses</option>
        {Object.values(OrderStatus).map((s) => (
          <option key={s} value={s}>
            {ORDER_STATUS[s].label}
          </option>
        ))}
      </AdminSelect>

      <label className="sr-only" htmlFor="order-payment-filter">
        Filter by payment
      </label>
      <AdminSelect
        id="order-payment-filter"
        value={paymentStatus ?? ""}
        onChange={(e) => setParam("payment", e.target.value)}
        className="sm:w-48"
        aria-label="Filter by payment"
      >
        <option value="">All payments</option>
        {Object.values(PaymentStatus).map((p) => (
          <option key={p} value={p}>
            {PAYMENT_STATUS[p].label}
          </option>
        ))}
      </AdminSelect>
    </div>
  );
}
