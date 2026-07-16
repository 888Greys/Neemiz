/**
 * Shared helpers for crediting / debiting UserCryptoBalance.
 *
 * All P2P routes that touch crypto balances should go through these helpers
 * so the logic stays in one place as we add on-chain settlement in phase 2.
 */

import { TransactionStatus, TransactionType, type Prisma } from "@prisma/client";
import { getPromoLockedKes, assertRealDepositForWithdrawal } from "@/lib/promo-lock";
import { isActiveLocalCoin } from "@/lib/p2p/local-coins";

// The tx parameter accepts either the full PrismaClient or a transaction client.
type TxClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Credit a user's available crypto balance (upsert — safe to call for any user).
 */
export async function creditUserCrypto(
  tx: TxClient,
  userId: string,
  crypto: string,
  network: string,
  amount: number,
) {
  await tx.userCryptoBalance.upsert({
    where:  { userId_crypto_network: { userId, crypto, network } },
    update: { available: { increment: amount } },
    create: { userId, crypto, network, available: amount, locked: 0 },
  });
}

/**
 * Lock an amount from available → locked (e.g. buyer placing an order on a BUY ad).
 * Throws if available balance is insufficient.
 */
export async function lockUserCrypto(
  tx: TxClient,
  userId: string,
  crypto: string,
  network: string,
  amount: number,
) {
  const balance = await tx.userCryptoBalance.findUnique({
    where: { userId_crypto_network: { userId, crypto, network } },
  });
  const avail = Number(balance?.available ?? 0);
  if (avail < amount) throw new Error("INSUFFICIENT_CRYPTO_BALANCE");

  await tx.userCryptoBalance.update({
    where: { userId_crypto_network: { userId, crypto, network } },
    data: {
      available: { decrement: amount },
      locked:    { increment: amount },
    },
  });
}

/**
 * Release a locked amount back to available (e.g. order cancelled / expired).
 */
export async function unlockUserCrypto(
  tx: TxClient,
  userId: string,
  crypto: string,
  network: string,
  amount: number,
) {
  await tx.userCryptoBalance.updateMany({
    where: { userId, crypto, network },
    data: {
      locked:    { decrement: amount },
      available: { increment: amount },
    },
  });
}

/**
 * Deduct from a user's available crypto balance (e.g. withdrawal).
 * Throws if insufficient.
 */
export async function debitUserCrypto(
  tx: TxClient,
  userId: string,
  crypto: string,
  network: string,
  amount: number,
) {
  // Keep the sufficient-balance check in the same database statement as the
  // decrement. A read followed by an update lets simultaneous withdrawals
  // both observe the same available balance.
  const debited = await tx.userCryptoBalance.updateMany({
    where: { userId, crypto, network, available: { gte: amount } },
    data: { available: { decrement: amount } },
  });
  if (debited.count === 0) throw new Error("INSUFFICIENT_CRYPTO_BALANCE");
}

// ─── KES coin (fiat-backed in-app P2P asset) ────────────────────────────────
// KES Coin is not on-chain and is no longer a separate converted balance.
// It is a 1:1 P2P alias of the user's fiat KES wallet balance:
// - placing a KES order debits/locks User.walletBalance
// - cancelling/expiring refunds User.walletBalance
// - releasing credits the receiver's User.walletBalance
// Existing UserCryptoBalance(KES/KES) rows are legacy-only and should not be
// used for new KES order accounting.

export const KES_COIN = "KES";
export const KES_NETWORK = "KES";
export function isKesCoin(crypto: string): boolean {
  return crypto?.toUpperCase() === KES_COIN;
}

/** Credit spendable KES Coin, backed directly by the user's fiat wallet. */
export async function creditKesCoinBalance(tx: TxClient, userId: string, amount: number) {
  await tx.user.update({
    where: { id: userId },
    data:  { walletBalance: { increment: amount } },
  });
}

/** Debit spendable KES Coin from the fiat wallet. Throws if insufficient. */
export async function debitKesCoinBalance(tx: TxClient, userId: string, amount: number) {
  const debited = await tx.user.updateMany({
    where: { id: userId, walletBalance: { gte: amount } },
    data:  { walletBalance: { decrement: amount } },
  });
  if (debited.count === 0) throw new Error("INSUFFICIENT_FIAT_BALANCE");
}

/**
 * Lock KES Coin by debiting the fiat wallet. Throws if insufficient.
 *
 * Enforces the deposit-to-withdraw promo gate at the P2P escrow choke point:
 * promo credit (and winnings staked from it) that hasn't been cash-unlocked by a
 * real deposit must not leave the wallet by selling KES Coin on P2P — otherwise
 * a P2P sell is a promo-farming exit that bypasses the M-Pesa/crypto withdrawal
 * gate (a never-funded promo account was cashing out via p2p_kes_escrow). Mirrors
 * the guard in /api/wallet/withdraw and /api/wallet/transfer. See lib/promo-lock.
 * Throws PROMO_LOCKED when the lock would dip into non-transferable promo funds,
 * or NO_DEPOSIT_GATE when the seller has never made a real deposit at all (an
 * unfunded account's balance is internal credit that must not exit via a P2P
 * sell — mirrors the withdraw route's generalized deposit-to-withdraw gate).
 */
export async function lockKesCoinBalance(tx: TxClient, userId: string, amount: number) {
  const u = await tx.user.findUnique({ where: { id: userId }, select: { walletBalance: true, isAdmin: true } });
  const bal = Number(u?.walletBalance ?? 0);
  const client = tx as unknown as Prisma.TransactionClient;
  await assertRealDepositForWithdrawal(client, userId, Boolean(u?.isAdmin));
  const promoLocked = await getPromoLockedKes(client, userId, bal);
  if (promoLocked > 0 && amount > bal - promoLocked + 1e-9) {
    throw new Error("PROMO_LOCKED");
  }
  const locked = await tx.user.updateMany({
    where: { id: userId, walletBalance: { gte: amount } },
    data:  { walletBalance: { decrement: amount } },
  });
  if (locked.count === 0) throw new Error("INSUFFICIENT_FIAT_BALANCE");
}

/** Refund locked KES Coin back to the fiat wallet, used for cancellations/expirations. */
export async function unlockKesCoinBalance(tx: TxClient, userId: string, amount: number) {
  await tx.user.update({
    where: { id: userId },
    data:  { walletBalance: { increment: amount } },
  });
}

/** Complete a KES Coin escrow transfer by crediting the receiver's fiat wallet. */
export async function releaseKesCoinBalance(
  tx: TxClient,
  _giverUserId: string,
  receiverUserId: string,
  _lockedAmount: number,
  payoutAmount: number,
) {
  await creditKesCoinBalance(tx, receiverUserId, payoutAmount);
}

export async function recordKesWalletMovement(
  tx: TxClient,
  input: {
    userId: string;
    amount: number;
    action: "lock" | "refund" | "release";
    orderId: string;
    role: "giver" | "receiver";
  },
) {
  await tx.transaction.create({
    data: {
      userId:   input.userId,
      type:     input.action === "refund" ? TransactionType.REFUND : input.action === "release" ? TransactionType.DEPOSIT : TransactionType.WITHDRAWAL,
      amount:   input.amount,
      currency: "KES",
      status:   TransactionStatus.COMPLETED,
      reference: `p2p-kes-${input.action}-${input.orderId}-${input.userId}`,
      provider: "p2p_kes_escrow",
      metadata: {
        action:  input.action,
        orderId: input.orderId,
        role:    input.role,
        asset:   "KES",
        rate:    1,
      },
    },
  });
}

// KES coin trades charge 1% from EACH side (2% total). The giver is escrowed
// amount + 1%, the receiver is paid amount − 1%, the platform keeps the 2%.
export const KES_FEE_RATE = 0.01;
/** What the giver is debited / refunded (order amount + their 1% fee). */
export const kesLockAmount   = (amount: number) => parseFloat((amount * (1 + KES_FEE_RATE)).toFixed(2));
/** What the receiver is paid (order amount − their 1% fee). */
export const kesPayoutAmount = (amount: number) => parseFloat((amount * (1 - KES_FEE_RATE)).toFixed(2));

// ─── Wallet-backed coins (KES + other in-app local coins) ────────────────────
// A "wallet-backed" P2P coin is escrowed PER-ORDER directly from the giver's own
// balance — there is no merchant P2P escrow reservation at ad creation. KES uses
// the fiat wallet (User.walletBalance); every other in-app local coin uses its
// UserCryptoBalance(crypto / crypto) row. They all share KES's 1%/1% pegged fee
// model (kesLockAmount / kesPayoutAmount). This is what makes an in-app coin sell
// "like KES Coin": hold it in your wallet and sell straight from there.

/** True for any coin escrowed per-order from the giver's own balance (KES + in-app coins). */
export function isWalletBackedCoin(crypto: string): boolean {
  return isActiveLocalCoin(crypto);
}

/**
 * Lock `amount` (fee-inclusive) into escrow from the giver's own balance.
 * Non-KES in-app local coins may top up any shortfall from free fiat KES at FX
 * (see lib/p2p/local-coin-convert) so a merchant can sell NGN/UGX/… from KES.
 */
export async function lockWalletCoin(
  tx: TxClient,
  userId: string,
  crypto: string,
  amount: number,
  opts?: { reservedKes?: number },
) {
  if (isKesCoin(crypto)) return lockKesCoinBalance(tx, userId, amount);
  if (isActiveLocalCoin(crypto)) {
    const { fundLocalCoinShortfallFromKes } = await import("@/lib/p2p/local-coin-convert");
    await fundLocalCoinShortfallFromKes(tx, {
      userId,
      crypto,
      needAmount: amount,
      reservedKes: opts?.reservedKes,
    });
  }
  await lockUserCrypto(tx, userId, crypto, defaultNetwork(crypto), amount);
}

/** Refund a locked amount back to the giver (cancel / expire / dispute refund). */
export async function unlockWalletCoin(tx: TxClient, userId: string, crypto: string, amount: number) {
  if (isKesCoin(crypto)) return unlockKesCoinBalance(tx, userId, amount);
  await unlockUserCrypto(tx, userId, crypto, defaultNetwork(crypto), amount);
}

/**
 * Complete an escrow transfer: consume the giver's locked `lockedAmount` and pay
 * the receiver `payoutAmount`; the platform keeps the difference (the 2% spread).
 */
export async function releaseWalletCoin(
  tx: TxClient,
  giverUserId: string,
  receiverUserId: string,
  crypto: string,
  lockedAmount: number,
  payoutAmount: number,
) {
  if (isKesCoin(crypto)) {
    return releaseKesCoinBalance(tx, giverUserId, receiverUserId, lockedAmount, payoutAmount);
  }
  const network = defaultNetwork(crypto);
  // The giver's balance was moved available→locked at order creation; consume the
  // whole locked amount here (the fee stays out of circulation) and pay the receiver.
  const debited = await tx.userCryptoBalance.updateMany({
    where: { userId: giverUserId, crypto, network, locked: { gte: lockedAmount } },
    data:  { locked: { decrement: lockedAmount } },
  });
  if (debited.count === 0) throw new Error("INSUFFICIENT_LOCKED_CRYPTO");
  await creditUserCrypto(tx, receiverUserId, crypto, network, payoutAmount);
}

/** Audit row for a wallet-backed-coin escrow movement (generalises recordKesWalletMovement). */
export async function recordWalletCoinMovement(
  tx: TxClient,
  input: {
    userId: string;
    crypto: string;
    amount: number;
    action: "lock" | "refund" | "release";
    orderId: string;
    role: "giver" | "receiver";
  },
) {
  if (isKesCoin(input.crypto)) {
    return recordKesWalletMovement(tx, {
      userId: input.userId, amount: input.amount, action: input.action, orderId: input.orderId, role: input.role,
    });
  }
  await tx.transaction.create({
    data: {
      userId:    input.userId,
      type:      input.action === "refund" ? TransactionType.REFUND : input.action === "release" ? TransactionType.DEPOSIT : TransactionType.WITHDRAWAL,
      amount:    input.amount,
      currency:  input.crypto,
      status:    TransactionStatus.COMPLETED,
      reference: `p2p-${input.crypto.toLowerCase()}-${input.action}-${input.orderId}-${input.userId}`,
      provider:  "p2p_incoin_escrow",
      metadata:  { action: input.action, orderId: input.orderId, role: input.role, asset: input.crypto, rate: 1 },
    },
  });
}

// ─── Real-crypto P2P platform fee (maker-pays / Binance-style) ───────────────
// The MAKER (the merchant who posts the ad) bears the fee; the TAKER is always
// made whole. Configurable via P2P_FEE_RATE (set 0 to run a zero-fee promo).
//   • SELL ad: at ad creation the merchant escrows amount * (1 + feeRate). On
//     release the buyer (taker) receives the FULL amount; the platform keeps the
//     feeRate share out of the merchant's escrow.
//   • BUY ad: the taker delivers the FULL amount; the merchant (maker) receives
//     amount * (1 - feeRate); the platform keeps the rest.
// KES Coin keeps its own 1%/1% split (kesLockAmount/kesPayoutAmount) for now.

const round8 = (n: number) => parseFloat(n.toFixed(8));
const round2 = (n: number) => parseFloat(n.toFixed(2));

/** Current configured P2P fee rate (default 2%). */
export function p2pFeeRate(): number {
  const r = Number(process.env.P2P_FEE_RATE ?? "0.02");
  return Number.isFinite(r) && r >= 0 && r < 1 ? r : 0.02;
}
/** What the maker must lock to sell `amount` (amount + fee). */
export const p2pMakerLock = (amount: number, rate = p2pFeeRate()) => round8(amount * (1 + rate));
/** What the maker receives when buying `amount` (amount − fee). */
export const p2pMakerReceives = (amount: number, rate = p2pFeeRate()) => round8(amount * (1 - rate));
/** The platform fee on `amount` at the given rate. */
export const p2pFeeOf = (amount: number, rate = p2pFeeRate()) => round8(amount * rate);

/**
 * Record a collected platform fee (crypto) so it is visible + auditable. Always
 * writes a `p2p_fee` Transaction; if P2P_FEE_MERCHANT_ID is set, also credits
 * that house merchant's escrow so the fee is a real spendable balance (keeping
 * the ledger fully balanced). No-op for zero/negative fees.
 */
export async function bookCryptoFee(
  tx: TxClient,
  input: {
    crypto: string; network: string; feeAmount: number; orderId: string; payerUserId: string;
    feeKesAmount?: number;
  },
) {
  if (!(input.feeAmount > 0)) return;
  await tx.transaction.create({
    data: {
      userId:    input.payerUserId,
      type:      TransactionType.WITHDRAWAL,
      amount:    input.feeAmount,
      currency:  input.crypto,
      status:    TransactionStatus.COMPLETED,
      reference: `p2p-fee-${input.orderId}`,
      provider:  "p2p_fee",
      metadata: {
        action: "p2p_platform_fee",
        orderId: input.orderId,
        crypto: input.crypto,
        network: input.network,
        // This locks the ledger's KES P&L valuation to the executed P2P price,
        // instead of repricing historical revenue against a later spot market.
        ...(Number.isFinite(input.feeKesAmount) && (input.feeKesAmount ?? 0) >= 0
          ? { feeKesAmount: round2(input.feeKesAmount!) }
          : {}),
      },
    },
  });
  const houseMerchantId = process.env.P2P_FEE_MERCHANT_ID;
  if (houseMerchantId) {
    await tx.p2PCryptoBalance.upsert({
      where:  { merchantId_crypto: { merchantId: houseMerchantId, crypto: input.crypto } },
      create: { merchantId: houseMerchantId, crypto: input.crypto, total: input.feeAmount, available: input.feeAmount, locked: 0 },
      update: { total: { increment: input.feeAmount }, available: { increment: input.feeAmount } },
    });
  }
}

/**
 * Settle a real-crypto (non-KES) trade release, applying the maker-pays fee.
 * Returns what the crypto receiver was credited. Throws INSUFFICIENT_LOCKED_CRYPTO
 * if the reserved balance is short.
 *
 *  - SELL: consume the merchant's locked reserve (amount + fee) from their
 *    UserCryptoBalance (one-wallet). Falls back to legacy P2PCryptoBalance for
 *    ads that locked merchant escrow before the migration. Credits the buyer
 *    the full amount; books the fee.
 *  - BUY: unlock the taker's full amount, credit the merchant amount − fee into
 *    their UserCryptoBalance (one-wallet), book the fee.
 */
export async function settleCryptoEscrowRelease(
  tx: TxClient,
  p: {
    crypto: string; network: string; amount: number; isMerchantSell: boolean;
    sellFeeRate: number; merchantId: string; merchantUserId: string; buyerId: string; orderId: string;
    feeKesPerCrypto?: number;
  },
): Promise<{ receiverGets: number }> {
  if (p.isMerchantSell) {
    const fee  = p2pFeeOf(p.amount, p.sellFeeRate);
    const draw = round8(p.amount + fee);

    // One-wallet path: ad creation locked UserCryptoBalance.
    const fromWallet = await tx.userCryptoBalance.updateMany({
      where: {
        userId: p.merchantUserId,
        crypto: p.crypto,
        network: p.network,
        locked: { gte: draw },
      },
      data: { locked: { decrement: draw } },
    });

    if (fromWallet.count === 0) {
      // Legacy merchant-escrow ads (pre one-wallet migration).
      const escrowBalance = await tx.p2PCryptoBalance.findUnique({
        where: { merchantId_crypto: { merchantId: p.merchantId, crypto: p.crypto } },
      });
      if (!escrowBalance) {
        await debitUserCrypto(tx, p.merchantUserId, p.crypto, p.network, p.amount);
      } else {
        const debited = await tx.p2PCryptoBalance.updateMany({
          where: { merchantId: p.merchantId, crypto: p.crypto, locked: { gte: draw }, total: { gte: draw } },
          data:  { locked: { decrement: draw }, total: { decrement: draw } },
        });
        if (debited.count === 0) throw new Error("INSUFFICIENT_LOCKED_CRYPTO");
      }
    }

    await creditUserCrypto(tx, p.buyerId, p.crypto, p.network, p.amount);
    await bookCryptoFee(tx, {
      crypto: p.crypto, network: p.network, feeAmount: fee, orderId: p.orderId, payerUserId: p.merchantUserId,
      feeKesAmount: Number.isFinite(p.feeKesPerCrypto) ? fee * p.feeKesPerCrypto! : undefined,
    });
    return { receiverGets: p.amount };
  }

  // BUY ad: taker delivers the full amount; merchant receives amount − fee in wallet.
  const fee = p2pFeeOf(p.amount);
  const unlocked = await tx.userCryptoBalance.updateMany({
    where: { userId: p.buyerId, crypto: p.crypto, network: p.network, locked: { gte: p.amount } },
    data:  { locked: { decrement: p.amount } },
  });
  if (unlocked.count === 0) throw new Error("INSUFFICIENT_LOCKED_CRYPTO");

  const makerReceives = p2pMakerReceives(p.amount);
  await creditUserCrypto(tx, p.merchantUserId, p.crypto, p.network, makerReceives);
  await bookCryptoFee(tx, {
    crypto: p.crypto, network: p.network, feeAmount: fee, orderId: p.orderId, payerUserId: p.merchantUserId,
    feeKesAmount: Number.isFinite(p.feeKesPerCrypto) ? fee * p.feeKesPerCrypto! : undefined,
  });
  return { receiverGets: makerReceives };
}

/**
 * Unlock an on-chain SELL ad reserve (pause / delete). Prefers UserCryptoBalance
 * (one-wallet); falls back to legacy P2PCryptoBalance for older ads.
 */
export async function unlockOnChainSellReserve(
  tx: TxClient,
  input: { userId: string; merchantId: string; crypto: string; amount: number },
) {
  const network = defaultNetwork(input.crypto);
  const amount = round8(input.amount);
  if (!(amount > 0)) return;

  const fromWallet = await tx.userCryptoBalance.updateMany({
    where: {
      userId: input.userId,
      crypto: input.crypto,
      network,
      locked: { gte: amount },
    },
    data: {
      locked: { decrement: amount },
      available: { increment: amount },
    },
  });
  if (fromWallet.count > 0) return;

  const fromEscrow = await tx.p2PCryptoBalance.updateMany({
    where: {
      merchantId: input.merchantId,
      crypto: input.crypto,
      locked: { gte: amount },
    },
    data: {
      locked: { decrement: amount },
      available: { increment: amount },
    },
  });
  if (fromEscrow.count === 0) throw new Error("INSUFFICIENT_LOCKED_CRYPTO");
}

/**
 * Infer the default network for a given crypto symbol.
 * Update this as new networks are added.
 */
export function defaultNetwork(crypto: string): string {
  const sym = crypto.toUpperCase();
  // Local coins (KES, UGX, TZS, …) are in-app currencies whose "network" is
  // simply their own currency code, so escrow balance rows key deterministically.
  if (isActiveLocalCoin(sym)) return sym;
  const map: Record<string, string> = {
    KES:   KES_NETWORK,
    USDT:  "TRC20",
    USDC:  "POLYGON",
    BTC:   "BTC",
    ETH:   "ERC20",
    BNB:   "BEP20",
    MATIC: "POLYGON",
  };
  return map[crypto.toUpperCase()] ?? "TRC20";
}
