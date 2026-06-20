import "server-only";

import { prisma } from "@/lib/db";
import type { NavBadgeCounts } from "@/components/admin/nav-config";

/**
 * Cheap count queries for the sidebar/topbar badges (doc 10 FR-32, §6.2
 * `getNavBadges`). Bounded, indexed reads only — never scans raw analytics.
 *
 * Low-stock here counts non-made-to-order, active products at/under their
 * threshold OR out of stock (derived inventory state `low_stock`/`out_of_stock`,
 * CANON §6; made-to-order excluded since always orderable, doc 10 FR-39).
 * Because `lowStockThreshold` is per-row, we approximate with a column-to-column
 * comparison via `prisma.$queryRaw`-free logic: a count of out-of-stock plus a
 * count of low-stock using a raw expression.
 */
export async function getNavBadges(): Promise<NavBadgeCounts> {
  const [pendingOrders, lowStock, newInquiries, newMessages, pendingReviews] =
    await Promise.all([
      prisma.order.count({ where: { status: "pending_confirmation" } }),
      countLowStock(),
      prisma.bulkInquiry.count({ where: { status: "new" } }),
      prisma.contactMessage.count({ where: { status: "new" } }),
      prisma.review.count({ where: { status: "pending" } }),
    ]);

  return { pendingOrders, lowStock, newInquiries, newMessages, pendingReviews };
}

/**
 * Count products needing stock attention: active, not made-to-order, and either
 * out of stock (`qty <= 0`) or low (`qty <= lowStockThreshold`). Prisma can't
 * compare two columns in a `where`, so we use a small raw count.
 */
async function countLowStock(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "products"
    WHERE "status" = 'active'
      AND "madeToOrder" = false
      AND "inventoryQuantity" <= "lowStockThreshold"
  `;
  return Number(rows[0]?.count ?? 0);
}
