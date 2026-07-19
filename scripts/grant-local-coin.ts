/**
 * Grants an in-app local coin (UG Coin, TZ Coin, NG Coin, …) to local dev accounts.
 *
 * Mirrors POST /api/admin/p2p/grant-coin, but without the owner-admin HTTP gate —
 * that route needs a valid admin 2FA cookie, which can't be minted under dev auth
 * (no email/SMS rail locally). This calls the SAME domain helpers the route does
 * (creditUserCrypto + the DEPOSIT Transaction record), so behaviour can't drift.
 *
 * Local coins are 1:1-pegged marketing instruments with no deposit rail, so they
 * are seeded rather than deposited. KES is rejected — that's the fiat wallet
 * (User.walletBalance), not the crypto escrow rails.
 *
 * SAFETY: refuses to run unless DATABASE_URL points at localhost.
 *
 * Run:
 *   bun run scripts/grant-local-coin.ts
 *   bun run scripts/grant-local-coin.ts --coin UGX --amount 1000000 --users usera,userb
 */
import { db } from "@/lib/db";
import { creditUserCrypto, defaultNetwork, isKesCoin } from "@/lib/p2p/crypto-balance";
import { isActiveLocalCoin, localCoinName } from "@/lib/p2p/local-coins";
import { TransactionType, TransactionStatus } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error(
    `\n  Refusing to grant: DATABASE_URL is not local.\n  Got: ${url || "(empty)"}\n  Point it at your local Postgres first (see LOCAL-DEV.md).\n`,
  );
  process.exit(1);
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const coin = arg("coin", "UGX").toUpperCase();
const amount = Number(arg("amount", "1000000"));
const usernames = arg("users", "usera,userb,owner").split(",").map((u) => u.trim()).filter(Boolean);

// Same validation the admin route applies.
if (!isActiveLocalCoin(coin) || isKesCoin(coin)) {
  console.error(`\n  "${coin}" must be an active in-app local coin (and not KES).\n`);
  process.exit(1);
}
if (!Number.isFinite(amount) || amount <= 0) {
  console.error(`\n  amount must be a positive number, got "${amount}".\n`);
  process.exit(1);
}

async function main() {
  const network = defaultNetwork(coin);
  console.log(`\n  Granting ${amount.toLocaleString()} ${localCoinName(coin)} (${coin} / ${network})\n`);

  for (const username of usernames) {
    const target = await db.user.findUnique({
      where:  { username },
      select: { id: true, username: true },
    });
    if (!target) {
      console.log(`  ✗ ${username} — no such user, skipped`);
      continue;
    }

    await db.$transaction(async (tx) => {
      await creditUserCrypto(tx, target.id, coin, network, amount);
      await tx.transaction.create({
        data: {
          userId:    target.id,
          type:      TransactionType.DEPOSIT,
          amount,
          currency:  coin,
          status:    TransactionStatus.COMPLETED,
          reference: `local-grant-${coin.toLowerCase()}-${target.id}-${Date.now()}`,
          provider:  "admin_incoin_grant",
          metadata:  { action: "local_dev_grant", asset: coin },
        },
      });
    });

    const balance = await db.userCryptoBalance.findUnique({
      where:  { userId_crypto_network: { userId: target.id, crypto: coin, network } },
      select: { available: true, locked: true },
    });
    console.log(
      `  ✓ ${target.username} → available ${Number(balance?.available ?? 0).toLocaleString()} ${coin}` +
      ` (locked ${Number(balance?.locked ?? 0).toLocaleString()})`,
    );
  }

  console.log(`\n  Done. Note: this INCREMENTS (same as the admin route) — re-running stacks.\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
