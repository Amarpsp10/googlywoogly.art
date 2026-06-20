import "server-only";

import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * In development, Next.js hot-reload re-evaluates modules, which would otherwise
 * create a new PrismaClient (and a new connection pool) on every change and
 * exhaust DB connections. We cache the instance on `globalThis`.
 *
 * `server-only` guards against this module ever being imported into a Client
 * Component bundle. Scripts that run outside Next (e.g. prisma/seed.ts) create
 * their own PrismaClient instead of importing this module.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
