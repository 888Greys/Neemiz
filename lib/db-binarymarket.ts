import { PrismaClient } from "@prisma/client";

/**
 * Prisma client for the BinaryMarket database (same Postgres host,
 * DB name `binarymarket`). Used by Nezeem admin ops + Lipa webhook dual-credit
 * when multiple brands share one Lipa merchant/callback URL.
 *
 * Set BINARYMARKET_DATABASE_URL on the Nezeem runtime only.
 */
const globalForBinarymarket = globalThis as unknown as { prismaBinarymarket?: PrismaClient | null };

function makeClient(): PrismaClient | null {
  const url = process.env.BINARYMARKET_DATABASE_URL?.trim();
  if (!url) return null;
  return new PrismaClient({ datasources: { db: { url } } });
}

export function binarymarketDb(): PrismaClient | null {
  if (globalForBinarymarket.prismaBinarymarket !== undefined) return globalForBinarymarket.prismaBinarymarket;
  const client = makeClient();
  globalForBinarymarket.prismaBinarymarket = client;
  return client;
}
