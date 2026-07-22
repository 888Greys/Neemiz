import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

// Cache on the global in ALL environments. In production, Next can evaluate
// this module more than once (separate route/server-component bundles in the
// build output), and a dev-only guard means each evaluation spins up a fresh
// PrismaClient — a new connection pool that is never reused or closed. Those
// leaked idle pools accumulated until Postgres ran out of connection slots and
// every auth call 500'd (SQLSTATE 53300). Caching unconditionally keeps one
// client per process. See lib/db-bok.ts / db-mbk.ts / db-binarymarket.ts.
globalForPrisma.prisma = db;
