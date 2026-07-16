import { db } from "../lib/db";
import { defaultNetwork, isWalletBackedCoin } from "../lib/p2p/crypto-balance";

async function main() {
  console.log("Starting P2P Escrow Migration...");

  // Find all active SELL ads of on-chain crypto
  const ads = await db.p2PAd.findMany({
    where: {
      side: "SELL",
      isActive: true,
    },
    include: {
      merchant: true,
    },
  });

  const onChainSellAds = ads.filter(ad => !isWalletBackedCoin(ad.crypto));
  console.log(`Found ${onChainSellAds.length} active on-chain SELL ads to migrate.`);

  let migratedCount = 0;

  for (const ad of onChainSellAds) {
    const feeRate = Number(ad.feeRate ?? 0.02);
    const amountToUnlock = Number(ad.availableAmount) * (1 + feeRate);
    const network = defaultNetwork(ad.crypto);
    const userId = ad.merchant.userId;

    console.log(`Migrating ad ${ad.id} (Merchant: ${ad.merchant.displayName}, Asset: ${ad.crypto}, Amount: ${ad.availableAmount}):`);

    try {
      await db.$transaction(async (tx) => {
        // Try updating UserCryptoBalance (one-wallet model)
        const walletResult = await tx.userCryptoBalance.updateMany({
          where: {
            userId,
            crypto: ad.crypto,
            network,
            locked: { gte: amountToUnlock },
          },
          data: {
            locked: { decrement: amountToUnlock },
            available: { increment: amountToUnlock },
          },
        });

        if (walletResult.count > 0) {
          console.log(`  Successfully moved ${amountToUnlock} ${ad.crypto} from locked to available in UserCryptoBalance.`);
          return;
        }

        // Fallback to legacy P2PCryptoBalance
        const legacyResult = await tx.p2PCryptoBalance.updateMany({
          where: {
            merchantId: ad.merchantId,
            crypto: ad.crypto,
            locked: { gte: amountToUnlock },
          },
          data: {
            locked: { decrement: amountToUnlock },
            available: { increment: amountToUnlock },
          },
        });

        if (legacyResult.count > 0) {
          console.log(`  Successfully moved ${amountToUnlock} ${ad.crypto} from locked to available in legacy P2PCryptoBalance.`);
        } else {
          console.log(`  Warning: Could not find locked balance for ${amountToUnlock} ${ad.crypto}. It may have already been unlocked or has insufficient locked balance.`);
        }
      });
      migratedCount++;
    } catch (e) {
      console.error(`  Error migrating ad ${ad.id}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`Migration complete. Migrated ${migratedCount} / ${onChainSellAds.length} ads.`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
