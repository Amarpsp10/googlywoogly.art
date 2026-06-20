import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Admin audit log — the CONTRACT helper every admin mutation calls after writing
 * (doc 10 FR-44, AC-17). Appends an `AuditLog` row capturing
 * `{ adminId, action, entityType, entityId, before?, after? }`.
 *
 * `AuditLog` is **append-only** (no update/delete). `before`/`after` are the
 * changed subset of the entity as JSON, **redacted** of secrets/PII before
 * persistence (doc 10 FR-46): `passwordHash`, any `*token*`/`*secret*`/
 * `*password*` key, and contact PII (full `phone`/`email`/`address`) are
 * stripped/masked so the log stays PII-light.
 *
 * `action` follows the `"{entity}.{verb}"` dot convention (doc 10 FR-45), e.g.
 * `product.update`, `order.status_change`, `site_setting.update`.
 */

export interface WriteAuditInput {
  /** The acting admin's `AdminUser.id` (from `requireAdmin()`). */
  adminId: string;
  /** Dot-cased action, e.g. `product.update` (doc 10 FR-45). */
  action: string;
  /** Entity model name, e.g. `Product`, `Order`. */
  entityType: string;
  /** The affected entity's id. */
  entityId: string;
  /** Pre-change snapshot (null for creates). */
  before?: unknown;
  /** Post-change snapshot (terminal state for deletes/archives). */
  after?: unknown;
}

/** Keys whose values are secrets — always dropped from snapshots. */
const SECRET_KEY_RE =
  /(passwordhash|password|token|secret|otp|salt|apikey|api_key)/i;

/** Keys that hold contact PII — masked rather than stored in the clear. */
const PII_MASK_KEYS = new Set(["phone", "email", "customerphone", "customeremail"]);

/** Keys whose (object) values are addresses — replaced with a redaction marker. */
const ADDRESS_KEYS = new Set(["address", "shippingaddress", "billingaddress"]);

/** Mask the middle of a string, keeping a little head/tail for recognisability. */
function maskValue(value: string): string {
  const s = value.trim();
  if (s.length <= 4) return "***";
  return `${s.slice(0, 2)}***${s.slice(-2)}`;
}

/**
 * Deep-redact a snapshot: drop secret keys, mask PII keys, redact address blobs.
 * Returns a plain JSON-safe value (or `Prisma.JsonNull` for `undefined`).
 */
function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (depth > 6) return null; // guard against pathological nesting
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  if (typeof value === "object") {
    // Dates serialise fine as ISO strings.
    if (value instanceof Date) return value.toISOString();
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (SECRET_KEY_RE.test(lower)) continue; // drop entirely
      if (ADDRESS_KEYS.has(lower)) {
        out[key] = "[redacted address]";
        continue;
      }
      if (PII_MASK_KEYS.has(lower) && typeof v === "string") {
        out[key] = maskValue(v);
        continue;
      }
      out[key] = redact(v, depth + 1);
    }
    return out;
  }

  return value; // primitives
}

/** Convert a (maybe-undefined) snapshot into a Prisma JSON input value. */
function toJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined) return Prisma.JsonNull;
  const redacted = redact(value);
  if (redacted === null || redacted === undefined) return Prisma.JsonNull;
  return redacted as Prisma.InputJsonValue;
}

/**
 * Append a redacted audit row. Best-effort: auditing must never mask the success
 * of the underlying mutation, so a logging failure is caught and reported to the
 * server console rather than thrown. (Callers that need atomic audit+mutate can
 * pass their own `tx` client.)
 */
export async function writeAudit(
  input: WriteAuditInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        adminId: input.adminId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: toJsonInput(input.before),
        after: toJsonInput(input.after),
      },
    });
  } catch (err) {
    console.error("[audit] failed to write AuditLog row", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      err,
    });
  }
}

/**
 * Ergonomic alias matching the doc's `logAdminAction(...)` naming. Identical
 * behaviour to `writeAudit` — provided so feature code can use either name.
 */
export const logAdminAction = writeAudit;
