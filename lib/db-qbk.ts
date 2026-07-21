import { PrismaClient } from "@prisma/client";

/**
 * Fourth Prisma client for the QuickBinary database (same Postgres host,
 * DB name `quickbinaryke`). Used by Nezeem admin ops + Lipa webhook dual-credit
 * when multiple brands share one Lipa merchant/callback URL.
 *
 * Set QUICKBINARYKE_DATABASE_URL on the Nezeem runtime only.
 */
const globalForQbk = globalThis as unknown as { prismaQbk?: PrismaClient | null };

function makeClient(): PrismaClient | null {
  const url = process.env.QUICKBINARYKE_DATABASE_URL?.trim();
  if (!url) return null;
  return new PrismaClient({ datasources: { db: { url } } });
}

export function qbkDb(): PrismaClient | null {
  if (globalForQbk.prismaQbk !== undefined) return globalForQbk.prismaQbk;
  const client = makeClient();
  globalForQbk.prismaQbk = client;
  return client;
}
