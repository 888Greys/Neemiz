import { db } from "@/lib/db";
import { isKesCoin, kesLockAmount, defaultNetwork } from "@/lib/p2p/crypto-balance";
import { isActiveLocalCoin } from "@/lib/p2p/local-coins";
import { convertToKES, getFxRatesToKES } from "@/lib/p2p/fx";

export async function getActiveKesSellBacking(merchantId: string, excludeAdId?: string) {
  const aggregate = await db.p2PAd.aggregate({
    where: {
      merchantId,
      side: "SELL",
      crypto: "KES",
      isActive: true,
      availableAmount: { gt: 0 },
      ...(excludeAdId ? { id: { not: excludeAdId } } : {}),
    },
    _sum: { availableAmount: true },
  });
  return kesLockAmount(Number(aggregate._sum.availableAmount ?? 0));
}

/**
 * Helper to compute the total KES backing required for all of a merchant's active ads (KES + local coins).
 * Accounts for local coin shortfalls converted to KES, correctly decrementing coin holdings to avoid double-counting.
 */
export async function getTotalKesReservedForMerchant(
  userId: string,
  merchantId: string,
  excludeAdId?: string,
  toKES?: Record<string, number>,
): Promise<number> {
  const rates = toKES ? { toKES } : await getFxRatesToKES();

  const ads = await db.p2PAd.findMany({
    where: {
      merchantId,
      side: "SELL",
      isActive: true,
      availableAmount: { gt: 0 },
      ...(excludeAdId ? { id: { not: excludeAdId } } : {}),
    },
    select: {
      crypto: true,
      availableAmount: true,
    },
  });

  const cryptoBalances = await db.userCryptoBalance.findMany({
    where: { userId },
    select: { crypto: true, network: true, available: true },
  });

  const balanceMap = new Map<string, number>();
  for (const cb of cryptoBalances) {
    if (cb.network === defaultNetwork(cb.crypto)) {
      balanceMap.set(cb.crypto.toUpperCase(), Number(cb.available));
    }
  }

  let totalKesRequired = 0;

  for (const ad of ads) {
    const cryptoSym = ad.crypto.toUpperCase();
    const need = kesLockAmount(Number(ad.availableAmount));

    if (isKesCoin(cryptoSym)) {
      totalKesRequired += need;
    } else if (isActiveLocalCoin(cryptoSym)) {
      const haveCoin = balanceMap.get(cryptoSym) ?? 0;
      const shortfall = Math.max(0, need - haveCoin);
      
      // Consume target coin balance so it cannot be double-counted by sibling ads
      balanceMap.set(cryptoSym, Math.max(0, haveCoin - need));

      if (shortfall > 0) {
        totalKesRequired += convertToKES(shortfall, cryptoSym, rates.toKES);
      }
    }
  }

  return parseFloat(totalKesRequired.toFixed(2));
}

export async function assertKesSellBacking(input: {
  userId: string;
  merchantId: string;
  walletBalance: number;
  crypto: string;
  side: "BUY" | "SELL";
  availableAmount: number;
  excludeAdId?: string;
}) {
  if (input.side !== "SELL" || !isKesCoin(input.crypto)) return null;
  
  try {
    const rates = await getFxRatesToKES();
    const existingBacking = await getTotalKesReservedForMerchant(
      input.userId,
      input.merchantId,
      input.excludeAdId,
      rates.toKES
    );
    const required = parseFloat((existingBacking + kesLockAmount(input.availableAmount)).toFixed(2));
    if (input.walletBalance >= required) return null;
    return {
      required,
      available: input.walletBalance,
      shortfall: parseFloat((required - input.walletBalance).toFixed(2)),
    };
  } catch (err) {
    if ((err as Error).message === "NO_FX_RATE") {
      return {
        error: "NO_FX_RATE",
        required: 0,
        available: input.walletBalance,
        shortfall: 0,
      };
    }
    throw err;
  }
}

/**
 * Asserts combined backing (target local coin + KES) for local coin SELL ads.
 * Calculates KES shortfall from all active local coin ads and ensures KES balance is sufficient.
 */
export async function assertLocalCoinSellBacking(input: {
  userId: string;
  merchantId: string;
  walletBalance: number;
  crypto: string;
  side: "BUY" | "SELL";
  availableAmount: number;
  excludeAdId?: string;
}) {
  if (input.side !== "SELL" || !isActiveLocalCoin(input.crypto)) return null;

  try {
    const rates = await getFxRatesToKES();

    // 1. Fetch other active ads of all coins (KES + local)
    const otherAds = await db.p2PAd.findMany({
      where: {
        merchantId: input.merchantId,
        side: "SELL",
        isActive: true,
        availableAmount: { gt: 0 },
        ...(input.excludeAdId ? { id: { not: input.excludeAdId } } : {}),
      },
      select: {
        crypto: true,
        availableAmount: true,
      },
    });

    const allProposedAds = [
      ...otherAds.map((a) => ({ crypto: a.crypto, availableAmount: Number(a.availableAmount) })),
      { crypto: input.crypto, availableAmount: input.availableAmount },
    ];

    // 2. Fetch crypto balances
    const cryptoBalances = await db.userCryptoBalance.findMany({
      where: { userId: input.userId },
      select: { crypto: true, network: true, available: true },
    });

    const balanceMap = new Map<string, number>();
    for (const cb of cryptoBalances) {
      if (cb.network === defaultNetwork(cb.crypto)) {
        balanceMap.set(cb.crypto.toUpperCase(), Number(cb.available));
      }
    }

    let totalKesRequired = 0;

    for (const ad of allProposedAds) {
      const cryptoSym = ad.crypto.toUpperCase();
      const need = kesLockAmount(ad.availableAmount);

      if (isKesCoin(cryptoSym)) {
        totalKesRequired += need;
      } else if (isActiveLocalCoin(cryptoSym)) {
        const haveCoin = balanceMap.get(cryptoSym) ?? 0;
        const shortfall = Math.max(0, need - haveCoin);
        
        // Update the balance map to consume the coin
        balanceMap.set(cryptoSym, Math.max(0, haveCoin - need));

        if (shortfall > 0) {
          totalKesRequired += convertToKES(shortfall, cryptoSym, rates.toKES);
        }
      }
    }

    const required = parseFloat(totalKesRequired.toFixed(2));
    const available = input.walletBalance;

    if (available < required) {
      return {
        required,
        available,
        shortfall: parseFloat((required - available).toFixed(2)),
      };
    }

    return null;
  } catch (err) {
    if ((err as Error).message === "NO_FX_RATE") {
      return {
        error: "NO_FX_RATE",
        required: 0,
        available: input.walletBalance,
        shortfall: 0,
      };
    }
    throw err;
  }
}

/**
 * Scans all merchants and deactivates any active local coin ads if their
 * KES wallet balance cannot back the shortfall across their active local coin sell inventory.
 */
export async function deactivateUnbackedLocalCoinSellAds() {
  const merchants = await db.merchantProfile.findMany({
    where: {
      ads: {
        some: {
          side: "SELL",
          isActive: true,
          availableAmount: { gt: 0 },
        },
      },
    },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          walletBalance: true,
        },
      },
    },
  });

  if (merchants.length === 0) return [];

  const deactivatedMerchantIds: string[] = [];

  for (const merchant of merchants) {
    try {
      const walletBalance = Number(merchant.user.walletBalance ?? 0);
      const totalKesRequired = await getTotalKesReservedForMerchant(merchant.userId, merchant.id);
      
      if (walletBalance < totalKesRequired) {
        await db.p2PAd.updateMany({
          where: {
            merchantId: merchant.id,
            side: "SELL",
            isActive: true,
            availableAmount: { gt: 0 },
          },
          data: { isActive: false },
        });
        deactivatedMerchantIds.push(merchant.id);
      }
    } catch (err) {
      console.error(`Skipping deactivation check for merchant ${merchant.id} due to rate error:`, err);
    }
  }

  return deactivatedMerchantIds;
}
