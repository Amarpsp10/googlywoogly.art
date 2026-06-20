/**
 * Shared auth types & role helpers. This module is **edge-safe** (no `prisma`,
 * no `next/headers`, no Node built-ins) so it can be imported from
 * `middleware.ts`, the session layer, and the admin shell alike.
 *
 * `AdminRole` is the Prisma enum (CANON §6). The session JWT carries the minimal
 * claim set `{ sub: adminId, role }` (doc 10 FR-3); the full `AdminUser` is
 * loaded from the DB on the node side by `getCurrentAdmin()`.
 */
import type { AdminRole } from "@prisma/client";

export type { AdminRole };

/**
 * The authenticated admin as surfaced to admin pages/actions. A PII-light
 * projection of `AdminUser` (CANON §5) — never carries `passwordHash`,
 * lockout counters, or reset tokens.
 */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: Date | null;
}

/** Claims embedded in the signed session JWT (doc 10 FR-3). */
export interface SessionPayload {
  /** `AdminUser.id` (JWT `sub`). */
  sub: string;
  role: AdminRole;
}

/**
 * Role hierarchy rank. Higher = more privileged. Used for the "minimum role"
 * style checks; owner-exclusive surfaces (Team, Audit Log) are gated by an
 * explicit role list instead (doc 10 §5.4, FR-23).
 */
export const ROLE_RANK: Record<AdminRole, number> = {
  staff: 1,
  admin: 2,
  owner: 3,
};

/** True when `role` meets or exceeds `min` in the hierarchy. */
export function roleAtLeast(role: AdminRole, min: AdminRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** True when `role` is one of the explicitly allowed roles. */
export function roleAllowed(
  role: AdminRole,
  allowed: readonly AdminRole[],
): boolean {
  return allowed.includes(role);
}

/**
 * Owner-exclusive areas: Team/admin management & Audit Log are accountability
 * surfaces `admin` does NOT inherit (doc 10 §5.4, FR-23).
 */
export const OWNER_ONLY_ROLES: readonly AdminRole[] = ["owner"];

/** Areas `staff` may NOT access (fulfilment-only helper, doc 10 §5.4). */
export const NON_STAFF_ROLES: readonly AdminRole[] = ["owner", "admin"];

/** Human label for a role badge. */
export const ROLE_LABEL: Record<AdminRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
};

/** `true` when this role is barred from seeing margin/financial figures. */
export function hidesFinancials(role: AdminRole): boolean {
  return role === "staff";
}
