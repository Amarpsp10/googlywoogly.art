import { describe, it, expect, vi } from "vitest";

/**
 * Unit tests for the PURE order-line builder extracted from `placeOrder`. The
 * server-only collaborators (`@/lib/db`, `@/lib/email`, `@/lib/services/settings`)
 * are mocked so importing the `"use server"` module never loads `server-only`
 * (mirrors `app/actions/leads.test.ts`). The DB-backed `placeOrder` itself is
 * covered by the Playwright order-flow e2e (`16` FR-49), not here.
 *
 * What we assert is the security-critical core: prices come from the server
 * snapshot (never the client), stock is enforced for non-MTO lines, MTO lines are
 * always orderable, and snapshots/line totals are frozen correctly.
 */

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/email", () => ({ notifyOrderPlaced: vi.fn() }));
vi.mock("@/lib/services/settings", () => ({ getShippingDefaults: vi.fn() }));

import {
  buildOrderLines,
  type OrderProductSnapshot,
} from "@/lib/order-lines";
import type { CheckoutInput } from "@/lib/validations/checkout";

function product(
  over: Partial<OrderProductSnapshot> & { id: string },
): OrderProductSnapshot {
  return {
    price: 50000,
    sku: "SKU-1",
    title: "Hand-painted mug",
    inventoryQuantity: 10,
    madeToOrder: false,
    productionLeadTimeDays: null,
    primaryImageUrl: "https://cdn.example/mug.jpg",
    ...over,
  };
}

function mapOf(...ps: OrderProductSnapshot[]): Map<string, OrderProductSnapshot> {
  return new Map(ps.map((p) => [p.id, p]));
}

type Items = CheckoutInput["items"];

describe("buildOrderLines", () => {
  it("uses the server price (ignores the client's advisory unitPrice) and freezes the snapshot", () => {
    const items: Items = [
      { productId: "p1", quantity: 2, unitPrice: 1 /* lying client price */ },
    ];
    const res = buildOrderLines(items, mapOf(product({ id: "p1", price: 50000 })));

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.lines).toHaveLength(1);
    const line = res.lines[0];
    expect(line.unitPrice).toBe(50000); // server value, not the client's 1
    expect(line.lineTotal).toBe(100000); // 50000 * 2
    expect(line.productTitle).toBe("Hand-painted mug");
    expect(line.sku).toBe("SKU-1");
    expect(line.imageUrl).toBe("https://cdn.example/mug.jpg");
    expect(line.madeToOrderSnapshot).toBe(false);
    // pricedLines feed computeCartTotals — must carry the server price too.
    expect(res.pricedLines[0]).toEqual({ unitPrice: 50000, quantity: 2 });
  });

  it("carries optional personalization/gift notes and coalesces missing ones to null", () => {
    const items: Items = [
      {
        productId: "p1",
        quantity: 1,
        personalizationNote: "To Aarohi",
        giftMessage: "Happy birthday!",
      },
      { productId: "p2", quantity: 1 },
    ];
    const res = buildOrderLines(
      items,
      mapOf(product({ id: "p1" }), product({ id: "p2", sku: "SKU-2" })),
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.lines[0].personalizationNote).toBe("To Aarohi");
    expect(res.lines[0].giftMessage).toBe("Happy birthday!");
    expect(res.lines[1].personalizationNote).toBeNull();
    expect(res.lines[1].giftMessage).toBeNull();
  });

  it("rejects a non-made-to-order line when stock is insufficient (sold out)", () => {
    const items: Items = [{ productId: "p1", quantity: 5 }];
    const res = buildOrderLines(
      items,
      mapOf(product({ id: "p1", madeToOrder: false, inventoryQuantity: 4 })),
    );

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/just sold out/i);
  });

  it("allows a made-to-order line with zero inventory and snapshots its lead time", () => {
    const items: Items = [{ productId: "p1", quantity: 3 }];
    const res = buildOrderLines(
      items,
      mapOf(
        product({
          id: "p1",
          madeToOrder: true,
          inventoryQuantity: 0,
          productionLeadTimeDays: 7,
        }),
      ),
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.lines[0].madeToOrderSnapshot).toBe(true);
    expect(res.lines[0].productionLeadTimeDaysSnapshot).toBe(7);
    expect(res.lines[0].lineTotal).toBe(150000); // 50000 * 3
  });

  it("treats a missing product (inactive/archived/deleted) as unavailable", () => {
    const items: Items = [{ productId: "ghost", quantity: 1 }];
    const res = buildOrderLines(items, mapOf(product({ id: "p1" })));

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/no longer available/i);
  });

  it("accepts exact-stock boundary (inventoryQuantity === quantity)", () => {
    const items: Items = [{ productId: "p1", quantity: 4 }];
    const res = buildOrderLines(
      items,
      mapOf(product({ id: "p1", madeToOrder: false, inventoryQuantity: 4 })),
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.lines[0].quantity).toBe(4);
  });

  it("falls back to a null imageUrl when the product has no primary image", () => {
    const items: Items = [{ productId: "p1", quantity: 1 }];
    const res = buildOrderLines(
      items,
      mapOf(product({ id: "p1", primaryImageUrl: null })),
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.lines[0].imageUrl).toBeNull();
  });
});
