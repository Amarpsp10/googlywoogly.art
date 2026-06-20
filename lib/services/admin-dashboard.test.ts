// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// `server-only` (imported transitively via the service → db) throws outside an
// RSC bundle; neutralise it. The service also imports `@/lib/db` for `prisma`,
// which we replace with an in-test stub so no database is touched.
vi.mock("server-only", () => ({}));

/**
 * Minimal Prisma stub. Defined via `vi.hoisted` so the mock fns exist before the
 * (hoisted) `vi.mock` factory runs. `$transaction([...])` resolves the array
 * (our reads return concrete values, not PrismaPromises); `$queryRaw` returns
 * the low-stock count rows. Tests program each model method per case.
 */
const { order, bulkInquiry, contactMessage, auditLog, orderStatusEvent, queryRaw } =
  vi.hoisted(() => ({
    order: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    bulkInquiry: { count: vi.fn() },
    contactMessage: { count: vi.fn() },
    auditLog: { findMany: vi.fn() },
    orderStatusEvent: { findMany: vi.fn() },
    queryRaw: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (ops: unknown[]) => Promise.all(ops),
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
    order,
    bulkInquiry,
    contactMessage,
    auditLog,
    orderStatusEvent,
  },
}));

import {
  getDashboardKpis,
  getRecentActivity,
} from "./admin-dashboard";

beforeEach(() => {
  vi.clearAllMocks();
  // Sensible defaults; individual tests override what they assert on.
  order.count.mockResolvedValue(0);
  order.aggregate.mockResolvedValue({ _sum: { grandTotal: 0 } });
  bulkInquiry.count.mockResolvedValue(0);
  contactMessage.count.mockResolvedValue(0);
  // `COUNT(*)::bigint` comes back as a JS bigint; `BigInt(...)` avoids the
  // ES2020 literal-syntax requirement under the project's tsc target.
  queryRaw.mockResolvedValue([{ count: BigInt(0) }]);
  auditLog.findMany.mockResolvedValue([]);
  orderStatusEvent.findMany.mockResolvedValue([]);
});

describe("getDashboardKpis revenue redaction (FR-26)", () => {
  it("omits aggregate revenue for staff (null, not zero) and never queries it", async () => {
    const kpis = await getDashboardKpis("staff");
    expect(kpis.revenueVisible).toBe(false);
    expect(kpis.revenueRequested7d).toBeNull();
    expect(kpis.revenueRequested30d).toBeNull();
    // No revenue aggregate query should run for staff.
    expect(order.aggregate).not.toHaveBeenCalled();
  });

  it("includes revenue for owner/admin", async () => {
    order.aggregate
      .mockResolvedValueOnce({ _sum: { grandTotal: 50_000 } }) // 7d
      .mockResolvedValueOnce({ _sum: { grandTotal: 120_000 } }); // 30d
    const kpis = await getDashboardKpis("owner");
    expect(kpis.revenueVisible).toBe(true);
    expect(kpis.revenueRequested7d).toBe(50_000);
    expect(kpis.revenueRequested30d).toBe(120_000);
  });

  it("sums new bulk inquiries and contact messages into newLeads", async () => {
    bulkInquiry.count.mockResolvedValue(3);
    contactMessage.count.mockResolvedValue(4);
    const kpis = await getDashboardKpis("admin");
    expect(kpis.newLeads).toBe(7);
  });

  it("reports the low-stock count from the raw query", async () => {
    queryRaw.mockResolvedValue([{ count: BigInt(5) }]);
    const kpis = await getDashboardKpis("admin");
    expect(kpis.lowStock).toBe(5);
  });
});

describe("getRecentActivity", () => {
  const auditRow = (over: Record<string, unknown> = {}) => ({
    id: "a1",
    action: "product.update",
    entityType: "Product",
    entityId: "p1",
    createdAt: new Date("2026-06-10T10:00:00Z"),
    admin: { name: "Vanshika" },
    ...over,
  });

  it("composes a human sentence with actor + verb + entity", async () => {
    auditLog.findMany.mockResolvedValue([auditRow()]);
    const items = await getRecentActivity("owner", 8);
    expect(items[0].message).toBe("Vanshika updated product");
    expect(items[0].href).toBe("/admin/products/p1");
    expect(items[0].actor).toBe("Vanshika");
  });

  it("hides settings/team/auth/coupon audit rows from staff (FR-40)", async () => {
    auditLog.findMany.mockResolvedValue([
      auditRow({ id: "s1", action: "site_setting.update", entityType: "SiteSetting" }),
      auditRow({ id: "u1", action: "admin_user.role_change", entityType: "AdminUser" }),
      auditRow({ id: "c1", action: "coupon.create", entityType: "Coupon" }),
      auditRow({ id: "au1", action: "auth.password_reset", entityType: "AdminUser" }),
      auditRow({ id: "ok", action: "order.status_change", entityType: "Order", entityId: "o9" }),
    ]);
    const staffItems = await getRecentActivity("staff", 8);
    const keys = staffItems.map((i) => i.key);
    expect(keys).toEqual(["audit:ok"]);

    // Owner sees them all.
    const ownerItems = await getRecentActivity("owner", 8);
    expect(ownerItems).toHaveLength(5);
  });

  it("merges audit + status events newest-first and respects the limit", async () => {
    auditLog.findMany.mockResolvedValue([
      auditRow({ id: "a-old", createdAt: new Date("2026-06-01T00:00:00Z") }),
    ]);
    orderStatusEvent.findMany.mockResolvedValue([
      {
        id: "e-new",
        status: "confirmed",
        createdAt: new Date("2026-06-12T00:00:00Z"),
        order: { id: "o1", orderNumber: "GW-2026-00042" },
        changedBy: { name: "Vanshika" },
      },
    ]);
    const items = await getRecentActivity("owner", 1);
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe("event:e-new");
    expect(items[0].message).toBe("Vanshika marked order GW-2026-00042 confirmed");
    expect(items[0].href).toBe("/admin/orders/o1");
  });

  it("falls back to 'System' actor when a status event has no admin", async () => {
    orderStatusEvent.findMany.mockResolvedValue([
      {
        id: "e1",
        status: "shipped",
        createdAt: new Date("2026-06-12T00:00:00Z"),
        order: { id: "o2", orderNumber: "GW-2026-00043" },
        changedBy: null,
      },
    ]);
    const items = await getRecentActivity("admin", 8);
    expect(items[0].message).toBe("System marked order GW-2026-00043 shipped");
  });
});
