// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

// `server-only` (imported transitively via audit.ts → db.ts) throws in the
// jsdom test environment; neutralise it.
vi.mock("server-only", () => ({}));

import { Prisma } from "@prisma/client";
import { writeAudit } from "./audit";

/**
 * A minimal stub of the bits of the Prisma client `writeAudit` touches, so we
 * can assert the (redacted) `data` it would persist without a database.
 */
function makeClient() {
  const create = vi.fn().mockResolvedValue({ id: "log_1" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = { auditLog: { create } } as any;
  return { client, create };
}

describe("writeAudit redaction", () => {
  it("persists the core fields", async () => {
    const { client, create } = makeClient();
    await writeAudit(
      {
        adminId: "admin_1",
        action: "product.update",
        entityType: "Product",
        entityId: "prod_1",
        before: { price: 1000 },
        after: { price: 1200 },
      },
      client,
    );
    expect(create).toHaveBeenCalledOnce();
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      adminId: "admin_1",
      action: "product.update",
      entityType: "Product",
      entityId: "prod_1",
      before: { price: 1000 },
      after: { price: 1200 },
    });
  });

  it("drops secret keys (passwordHash, tokens, secrets)", async () => {
    const { client, create } = makeClient();
    await writeAudit(
      {
        adminId: "a",
        action: "admin_user.update",
        entityType: "AdminUser",
        entityId: "u1",
        after: {
          name: "Vanshika",
          passwordHash: "$2b$12$shouldneverappear",
          tokenHash: "secret-token",
          apiKey: "sk-123",
          role: "owner",
        },
      },
      client,
    );
    const after = create.mock.calls[0][0].data.after;
    expect(after).toEqual({ name: "Vanshika", role: "owner" });
    expect(JSON.stringify(after)).not.toContain("shouldneverappear");
    expect(JSON.stringify(after)).not.toContain("secret-token");
    expect(JSON.stringify(after)).not.toContain("sk-123");
  });

  it("masks PII (phone/email) and redacts address blobs", async () => {
    const { client, create } = makeClient();
    await writeAudit(
      {
        adminId: "a",
        action: "order.update",
        entityType: "Order",
        entityId: "o1",
        after: {
          customerName: "Riya",
          customerPhone: "9876543210",
          customerEmail: "riya@example.com",
          shippingAddress: { line1: "12 MG Road", city: "Jaipur", pincode: "302001" },
        },
      },
      client,
    );
    const after = create.mock.calls[0][0].data.after;
    expect(after.customerName).toBe("Riya");
    expect(after.customerPhone).toBe("98***10");
    expect(after.customerEmail).toBe("ri***om");
    expect(after.shippingAddress).toBe("[redacted address]");
  });

  it("uses Prisma.JsonNull for an omitted before (create)", async () => {
    const { client, create } = makeClient();
    await writeAudit(
      {
        adminId: "a",
        action: "category.create",
        entityType: "Category",
        entityId: "c1",
        after: { name: "Diwali" },
      },
      client,
    );
    const data = create.mock.calls[0][0].data;
    expect(data.before).toBe(Prisma.JsonNull);
    expect(data.after).toEqual({ name: "Diwali" });
  });

  it("never throws if the underlying create fails (best-effort)", async () => {
    const create = vi.fn().mockRejectedValue(new Error("db down"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = { auditLog: { create } } as any;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      writeAudit(
        { adminId: "a", action: "x.y", entityType: "X", entityId: "1" },
        client,
      ),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
