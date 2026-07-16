/**
 * Dump EVERY generated crypto deposit address (the source of truth for what
 * was ever handed to a user), grouped by network. Paste the output back for
 * an independent on-chain balance check.
 *
 *   bun run scripts/dump-crypto-addresses.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const addresses = await db.cryptoDepositAddress.findMany({
  include: { user: { select: { email: true, username: true } } },
  orderBy: [{ network: "asc" }, { createdAt: "asc" }],
});

// Group by network so on-chain lookups can be batched per chain.
const byNetwork: Record<string, typeof addresses> = {};
for (const a of addresses) (byNetwork[a.network] ??= []).push(a);

console.log(`Total generated addresses: ${addresses.length}\n`);

for (const [network, rows] of Object.entries(byNetwork)) {
  console.log(`\n=== ${network} (${rows.length}) ===`);
  for (const a of rows) {
    console.log(
      `${a.address}\t${a.crypto}\thdIndex=${a.hdIndex ?? "?"}\t${a.user.email ?? a.user.username ?? a.userId}`,
    );
  }
}

await db.$disconnect();
