import { db } from "@/lib/db";
import { isKesCoin, kesLockAmount } from "@/lib/p2p/crypto-balance";

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

export async function deactivateUnbackedKesSellAds() {
  const merchants = await db.merchantProfile.findMany({
    where: {
      ads: {
        some: { side: "SELL", crypto: "KES", isActive: true, availableAmount: { gt: 0 } },
      },
    },
    select: {
      id: true,
      user: { select: { walletBalance: true } },
      ads: {
        where: { side: "SELL", crypto: "KES", isActive: true, availableAmount: { gt: 0 } },
        select: { availableAmount: true },
      },
    },
  });

  const unbackedIds = merchants
    .filter((merchant) => {
      const listed = merchant.ads.reduce((sum, ad) => sum + Number(ad.availableAmount), 0);
      return Number(merchant.user.walletBalance) < kesLockAmount(listed);
    })
    .map((merchant) => merchant.id);

  if (unbackedIds.length) {
    await db.p2PAd.updateMany({
      where: { merchantId: { in: unbackedIds }, side: "SELL", crypto: "KES", isActive: true },
      data: { isActive: false },
    });
  }
  return unbackedIds;
}
