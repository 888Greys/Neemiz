import { PrismaClient } from "@prisma/client";

/**
 * Second Prisma client for the BinaryOptionsKE database (same Postgres host,
 * DB name `binaryoptionske`). Used by Nezeem admin ops + Lipa webhook dual-credit
 * when both brands share one Lipa merchant/callback URL.
 *
 * Set BINARYOPTIONSKE_DATABASE_URL on the Nezeem runtime only.
 */
const globalForBok = globalThis as unknown as { prismaBok?: PrismaClient | null };

function makeClient(): PrismaClient | null {
  const url = process.env.BINARYOPTIONSKE_DATABASE_URL?.trim();
  if (!url) return null;
  return new PrismaClient({ datasources: { db: { url } } });
}

export function bokDb(): PrismaClient | null {
  if (globalForBok.prismaBok !== undefined) return globalForBok.prismaBok;
  const client = makeClient();
  if (process.env.NODE_ENV !== "production") globalForBok.prismaBok = client;
  else globalForBok.prismaBok = client;
  return client;
}
