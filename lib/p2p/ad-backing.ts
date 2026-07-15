import { db } from "@/lib/db";
import { isKesCoin, kesLockAmount, defaultNetwork } from "@/lib/p2p/crypto-balance";
import { isActiveLocalCoin } from "@/lib/p2p/local-coins";
import { convertToKes } from "@/lib/currency-config";
import { getFxRatesToKES } from "@/lib/p2p/fx";

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

export async function assertKesSellBacking(input: {
  merchantId: string;
  walletBalance: number;
  crypto: string;
  side: "BUY" | "SELL";
  availableAmount: number;
  excludeAdId?: string;
}) {
  if (input.side !== "SELL" || !isKesCoin(input.crypto)) return null;
  const existingBacking = await getActiveKesSellBacking(input.merchantId, input.excludeAdId);
  const required = parseFloat((existingBacking + kesLockAmount(input.availableAmount)).toFixed(2));
  if (input.walletBalance >= required) return null;
  return {
    required,
    available: input.walletBalance,
    shortfall: parseFloat((required - input.walletBalance).toFixed(2)),
  };
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

  // 1. Get current FX rates to KES
  const rates = await getFxRatesToKES();

  // 2. Fetch other active local coin SELL ads for this merchant
  const otherAds = await db.p2PAd.findMany({
    where: {
      merchantId: input.merchantId,
      side: "SELL",
      isActive: true,
      availableAmount: { gt: 0 },
      ...(input.excludeAdId ? { id: { not: input.excludeAdId } } : {}),
    },
    select: {
      id: true,
      crypto: true,
      availableAmount: true,
    },
  });

  const allAds = [
    ...otherAds.map((a) => ({ crypto: a.crypto, availableAmount: Number(a.availableAmount) })),
    { crypto: input.crypto, availableAmount: input.availableAmount },
  ];

  // 3. Fetch crypto balances for this user to check existing local coin holdings
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

  let totalKesShortfall = 0;

  for (const ad of allAds) {
    const cryptoSym = ad.crypto.toUpperCase();
    const need = kesLockAmount(ad.availableAmount);

    if (isKesCoin(cryptoSym)) {
      totalKesShortfall += need;
    } else if (isActiveLocalCoin(cryptoSym)) {
      const haveCoin = balanceMap.get(cryptoSym) ?? 0;
      const shortfall = Math.max(0, need - haveCoin);
      if (shortfall > 0) {
        const kesNeeded = convertToKes(shortfall, cryptoSym, rates.toKES);
        totalKesShortfall += kesNeeded;
      }
    }
  }

  const required = parseFloat(totalKesShortfall.toFixed(2));
  const available = input.walletBalance;

  if (available < required) {
    return {
      required,
      available,
      shortfall: parseFloat((required - available).toFixed(2)),
    };
  }

  return null;
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
      ads: {
        where: {
          side: "SELL",
          isActive: true,
          availableAmount: { gt: 0 },
        },
        select: {
          id: true,
          crypto: true,
          availableAmount: true,
        },
      },
    },
  });

  if (merchants.length === 0) return [];

  const rates = await getFxRatesToKES();
  const deactivatedMerchantIds: string[] = [];

  for (const merchant of merchants) {
    const activeLocalCoinAds = merchant.ads.filter((ad) => isActiveLocalCoin(ad.crypto));
    if (activeLocalCoinAds.length === 0) continue;

    const cryptoBalances = await db.userCryptoBalance.findMany({
      where: { userId: merchant.userId },
      select: { crypto: true, network: true, available: true },
    });

    const balanceMap = new Map<string, number>();
    for (const cb of cryptoBalances) {
      if (cb.network === defaultNetwork(cb.crypto)) {
        balanceMap.set(cb.crypto.toUpperCase(), Number(cb.available));
      }
    }

    let totalKesShortfall = 0;
    for (const ad of activeLocalCoinAds) {
      const cryptoSym = ad.crypto.toUpperCase();
      const need = kesLockAmount(Number(ad.availableAmount));

      if (isKesCoin(cryptoSym)) {
        totalKesShortfall += need;
      } else {
        const haveCoin = balanceMap.get(cryptoSym) ?? 0;
        const shortfall = Math.max(0, need - haveCoin);
        if (shortfall > 0) {
          totalKesShortfall += convertToKes(shortfall, cryptoSym, rates.toKES);
        }
      }
    }

    if (Number(merchant.user.walletBalance) < totalKesShortfall) {
      const adIdsToDeactivate = activeLocalCoinAds.map((ad) => ad.id);
      await db.p2PAd.updateMany({
        where: { id: { in: adIdsToDeactivate } },
        data: { isActive: false },
      });
      deactivatedMerchantIds.push(merchant.id);
    }
  }

  return deactivatedMerchantIds;
}
