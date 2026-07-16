import { db } from "@/lib/db";
import { isKesCoin, defaultNetwork } from "@/lib/p2p/crypto-balance";

/**
 * Total in-app local coin an admin has GRANTED to a user (per coin), summed from
 * the `admin_incoin_grant` ledger rows. Granted coin is an unbacked marketing
 * instrument with no offsetting KES liability, so it must NOT count as backing
 * for a sell ad — otherwise a merchant could sell phantom coin for real
 * off-platform cash. Only coin the merchant genuinely holds (deposited / bought /
 * KES-converted) backs a sale; the granted portion requires real KES to back it.
 * KES grants are excluded here (they credit the fiat wallet, governed separately).
 */
export async function getGrantedLocalCoinHoldings(userId: string): Promise<Map<string, number>> {
  const grants = await db.transaction.groupBy({
    by: ["currency"],
    where: { userId, provider: "admin_incoin_grant" },
    _sum: { amount: true },
  });
  const map = new Map<string, number>();
  for (const g of grants) {
    const code = g.currency.toUpperCase();
    if (isKesCoin(code)) continue;
    const amt = Number(g._sum.amount ?? 0);
    if (amt > 0) map.set(code, amt);
  }
  return map;
}

/**
 * After a trade settles, recalculate sibling SELL ad amounts so buyers see
 * accurate availability. Each ad is capped at the merchant's free balance.
 *
 * - KES Coin: free balance = User.walletBalance
 * - Non-KES local coins: free balance = UserCryptoBalance.available - getGrantedLocalCoinHoldings
 * - On-chain crypto: free balance = UserCryptoBalance.available
 *
 * Ads with availableAmount already <= freeBalance are left untouched.
 * Ads whose available would be <= 0 are deactivated.
 */
export async function recalcMerchantAdAmounts(
  merchantId: string,
  crypto: string,
): Promise<void> {
  const merchant = await db.merchantProfile.findUnique({
    where: { id: merchantId },
    select: { userId: true },
  });
  if (!merchant) return;

  // Determine the merchant's free (unlocked) balance for this asset.
  let freeBalance: number;

  if (isKesCoin(crypto)) {
    const user = await db.user.findUnique({
      where: { id: merchant.userId },
      select: { walletBalance: true },
    });
    freeBalance = Number(user?.walletBalance ?? 0);
  } else {
    const network = defaultNetwork(crypto);
    const bal = await db.userCryptoBalance.findUnique({
      where: { userId_crypto_network: { userId: merchant.userId, crypto, network } },
      select: { available: true },
    });
    const available = Number(bal?.available ?? 0);
    const grants = await getGrantedLocalCoinHoldings(merchant.userId);
    const grantedAmount = grants.get(crypto.toUpperCase()) ?? 0;
    freeBalance = Math.max(0, available - grantedAmount);
  }

  // Find active SELL ads for this merchant + crypto that are over the free balance.
  const ads = await db.p2PAd.findMany({
    where: {
      merchantId,
      side: "SELL",
      crypto,
      isActive: true,
    },
    select: { id: true, availableAmount: true },
  });

  for (const ad of ads) {
    const current = Number(ad.availableAmount);
    if (current <= freeBalance) continue;

    if (freeBalance <= 0) {
      // No balance left — deactivate the ad
      await db.p2PAd.update({
        where: { id: ad.id },
        data: { isActive: false, availableAmount: 0 },
      });
    } else {
      // Cap at merchant's free balance
      await db.p2PAd.update({
        where: { id: ad.id },
        data: { availableAmount: freeBalance },
      });
    }
  }
}
