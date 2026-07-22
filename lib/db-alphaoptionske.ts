import { PrismaClient } from "@prisma/client";

/**
 * Prisma client for the AlphaOptionsKE database (same Postgres host,
 * DB name `alphaoptionske`). Used by Nezeem admin ops + Lipa webhook dual-credit
 * when multiple brands share one Lipa merchant/callback URL.
 *
 * Set ALPHAOPTIONSKE_DATABASE_URL on the Nezeem runtime only.
 */
const globalForAlphaOptionsKE = globalThis as unknown as { prismaAlphaOptionsKE?: PrismaClient | null };

function makeClient(): PrismaClient | null {
  const url = process.env.ALPHAOPTIONSKE_DATABASE_URL?.trim();
  if (!url) return null;
  return new PrismaClient({ datasources: { db: { url } } });
}

export function alphaoptionskeDb(): PrismaClient | null {
  if (globalForAlphaOptionsKE.prismaAlphaOptionsKE !== undefined) return globalForAlphaOptionsKE.prismaAlphaOptionsKE;
  const client = makeClient();
  globalForAlphaOptionsKE.prismaAlphaOptionsKE = client;
  return client;
}
