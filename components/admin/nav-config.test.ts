import { describe, it, expect } from "vitest";
import { navForRole, ADMIN_NAV } from "./nav-config";

/** Collect the hrefs visible to a role across all groups. */
function visibleHrefs(role: "owner" | "admin" | "staff"): string[] {
  return navForRole(role).flatMap((g) => g.items.map((i) => i.href));
}

describe("navForRole gating (defense-in-depth, doc 10 §5.4)", () => {
  it("owner sees every nav item", () => {
    const all = ADMIN_NAV.flatMap((g) => g.items.map((i) => i.href));
    expect(visibleHrefs("owner").sort()).toEqual([...all].sort());
  });

  it("admin sees everything except owner-only Audit Log", () => {
    const hrefs = visibleHrefs("admin");
    expect(hrefs).not.toContain("/admin/audit-log");
    // admin retains catalog/content/settings
    expect(hrefs).toContain("/admin/categories");
    expect(hrefs).toContain("/admin/settings");
  });

  it("staff is restricted to fulfilment areas", () => {
    const hrefs = visibleHrefs("staff");
    // allowed
    expect(hrefs).toContain("/admin");
    expect(hrefs).toContain("/admin/orders");
    expect(hrefs).toContain("/admin/inventory");
    expect(hrefs).toContain("/admin/bulk-inquiries");
    expect(hrefs).toContain("/admin/messages");
    expect(hrefs).toContain("/admin/customers");
    // forbidden (catalog-write, content, settings, audit, reviews, collections)
    expect(hrefs).not.toContain("/admin/categories");
    expect(hrefs).not.toContain("/admin/collections");
    expect(hrefs).not.toContain("/admin/content");
    expect(hrefs).not.toContain("/admin/settings");
    expect(hrefs).not.toContain("/admin/audit-log");
    expect(hrefs).not.toContain("/admin/reviews");
  });

  it("drops empty groups after filtering", () => {
    // staff has no System items → the System group must not appear.
    const groups = navForRole("staff").map((g) => g.label);
    expect(groups).not.toContain("System");
  });
});
