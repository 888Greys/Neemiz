import { PrismaClient } from "@prisma/client";

/**
 * Third Prisma client for the MoneyBinary database (same Postgres host,
 * DB name `moneybinaryke`). Used by Nezeem admin ops + Lipa webhook dual-credit
 * when multiple brands share one Lipa merchant/callback URL.
 *
 * Set MONEYBINARYKE_DATABASE_URL on the Nezeem runtime only.
 */
const globalForMbk = globalThis as unknown as { prismaMbk?: PrismaClient | null };

function makeClient(): PrismaClient | null {
  const url = process.env.MONEYBINARYKE_DATABASE_URL?.trim();
  if (!url) return null;
  return new PrismaClient({ datasources: { db: { url } } });
}

export function mbkDb(): PrismaClient | null {
  if (globalForMbk.prismaMbk !== undefined) return globalForMbk.prismaMbk;
  const client = makeClient();
  globalForMbk.prismaMbk = client;
  return client;
}
