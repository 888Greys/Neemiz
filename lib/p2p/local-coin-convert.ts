/**
 * Fund in-app local coins (NGN, UGX, …) from the user's fiat KES wallet at live FX.
 *
 * Merchants hold one real cash balance (KES). Sell ads in other country coins
 * pull from that pool: any shortfall in the target coin is converted from free
 * KES (wallet minus soft-backing reserved by active KES sell ads), then the
 * normal per-order escrow lock runs against the local-coin wallet.
 */

import { TransactionStatus, TransactionType, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { convertToKes } from "@/lib/currency-config";
import { getFxRatesToKES } from "@/lib/p2p/fx";
import {
  creditUserCrypto,
  defaultNetwork,
  isKesCoin,
  lockKesCoinBalance,
} from "@/lib/p2p/crypto-balance";
import { isActiveLocalCoin } from "@/lib/p2p/local-coins";

type TxClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const round2 = (n: number) => parseFloat(n.toFixed(2));

export function isCrossMarketLocalCoin(crypto: string): boolean {
  return isActiveLocalCoin(crypto) && !isKesCoin(crypto);
}

/**
 * Convert enough free KES into `crypto` so available >= needAmount.
 * Throws INSUFFICIENT_FIAT_BALANCE / PROMO_LOCKED / NO_DEPOSIT_GATE / NO_FX_RATE.
 */
export async function fundLocalCoinShortfallFromKes(
  tx: TxClient,
  input: {
    userId: string;
    crypto: string;
    needAmount: number;
    /** Soft-reserved KES for active KES Coin sell ads (defaults to 0). */
    reservedKes?: number;
    toKES?: Record<string, number>;
  },
): Promise<{ converted: boolean; kesSpent: number; coinCredited: number }> {
  const crypto = input.crypto.toUpperCase();
  if (!isCrossMarketLocalCoin(crypto)) {
    return { converted: false, kesSpent: 0, coinCredited: 0 };
  }

  const need = round2(input.needAmount);
  if (!(need > 0)) return { converted: false, kesSpent: 0, coinCredited: 0 };

  const network = defaultNetwork(crypto);
  const bal = await tx.userCryptoBalance.findUnique({
    where: { userId_crypto_network: { userId: input.userId, crypto, network } },
    select: { available: true },
  });
  const have = round2(Number(bal?.available ?? 0));
  const shortfall = round2(Math.max(0, need - have));
  if (shortfall <= 0) return { converted: false, kesSpent: 0, coinCredited: 0 };

  const toKES = input.toKES ?? (await getFxRatesToKES()).toKES;
  const kesPerUnit = toKES[crypto];
  if (!(kesPerUnit > 0)) throw new Error("NO_FX_RATE");

  // Round KES up so FX dust never leaves the coin wallet short of `shortfall`.
  const kesNeeded = Math.ceil(convertToKes(shortfall, crypto, toKES) * 100) / 100;
  const user = await tx.user.findUnique({
    where: { id: input.userId },
    select: { walletBalance: true },
  });
  const wallet = Number(user?.walletBalance ?? 0);
  const reserved = Math.max(0, Number(input.reservedKes ?? 0));
  const freeKes = round2(Math.max(0, wallet - reserved));
  if (kesNeeded > freeKes + 1e-9) throw new Error("INSUFFICIENT_FIAT_BALANCE");

  // Promo / deposit gates — same as selling KES Coin (cash exit via P2P).
  await lockKesCoinBalance(tx, input.userId, kesNeeded);
  // Credit the exact shortfall; KES was rounded up so FX dust stays on the house.
  await creditUserCrypto(tx, input.userId, crypto, network, shortfall);
  const credit = shortfall;

  const ref = `kes-coin-convert-${crypto.toLowerCase()}-${input.userId}-${Date.now()}`;
  await tx.transaction.create({
    data: {
      userId: input.userId,
      type: TransactionType.WITHDRAWAL,
      amount: kesNeeded,
      currency: "KES",
      status: TransactionStatus.COMPLETED,
      reference: `${ref}-out`,
      provider: "kes_coin_convert",
      metadata: {
        action: "convert_out",
        from: "KES",
        to: crypto,
        kesSpent: kesNeeded,
        coinCredited: credit,
        rateKesPerUnit: kesPerUnit,
      },
    },
  });
  await tx.transaction.create({
    data: {
      userId: input.userId,
      type: TransactionType.DEPOSIT,
      amount: credit,
      currency: crypto,
      status: TransactionStatus.COMPLETED,
      reference: `${ref}-in`,
      provider: "kes_coin_convert",
      metadata: {
        action: "convert_in",
        from: "KES",
        to: crypto,
        kesSpent: kesNeeded,
        coinCredited: credit,
        rateKesPerUnit: kesPerUnit,
      },
    },
  });

  return { converted: true, kesSpent: kesNeeded, coinCredited: credit };
}

