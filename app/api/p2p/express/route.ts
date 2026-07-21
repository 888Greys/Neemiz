import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { p2pBlockedResponse, p2pPairDeniedResponse, p2pAllowedCounterparties } from "@/lib/p2p/user-guard";
import { withdrawalsDisabledResponse } from "@/lib/withdrawal-guard";
import { isP2PAdTradable } from "@/lib/p2p/ad-guards";
import { kesLockAmount, isWalletBackedCoin, isKesCoin, lockWalletCoin, recordWalletCoinMovement, lockUserCrypto, defaultNetwork } from "@/lib/p2p/crypto-balance";
import { sendNewP2POrderEmail, waitForEmailDelivery } from "@/lib/brevo";
import { FIAT_CURRENCIES } from "@/lib/p2p/currencies";
import { assertCanCreateP2POrder } from "@/lib/p2p/cancellation-policy";
import { ACTIVE_LOCAL_COIN_CODES } from "@/lib/p2p/local-coins";
import { detectP2PRingSignals } from "@/lib/p2p/ring-detection";

const VALID_CRYPTOS = new Set(["USDT", "USDC", "BTC", "ETH", "BNB", ...ACTIVE_LOCAL_COIN_CODES]);
const VALID_FIATS   = new Set(FIAT_CURRENCIES.map((f) => f.code));

/**
 * POST /api/p2p/express — instant buy.
 *
 * The user says "buy <amount> <fiat> of <crypto> via <paymentMethod>"; we
 * auto-match the best-priced SELL ad (lowest price, covers the amount,
 * supports the rail) and open a normal escrow-protected order against it —
 * no manual ad picking. Settlement reuses the standard order flow.
 *
 * Body: { crypto, fiat, amount, paymentMethod }  (amount is in fiat)
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const killed = await withdrawalsDisabledResponse();
    if (killed) return killed;

    const dbUser = await getOrCreateUser(user.id, { email: user.email });

    const p2pDenied = await p2pBlockedResponse(dbUser.email);
    if (p2pDenied) return p2pDenied;    const restriction = await assertCanCreateP2POrder(dbUser.id);
    if (restriction) return restriction;

    let body: Record<string, unknown>;
    try { body = await req.json(); }
    catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }

    const crypto        = String(body.crypto ?? "").toUpperCase();
    const fiat          = String(body.fiat ?? "").toUpperCase();
    const paymentMethod = String(body.paymentMethod ?? "");
    const amount        = Number(body.amount);

    if (!VALID_CRYPTOS.has(crypto)) return Response.json({ error: "Unsupported crypto" }, { status: 400 });
    if (!VALID_FIATS.has(fiat))     return Response.json({ error: "Unsupported currency" }, { status: 400 });
    if (!paymentMethod)             return Response.json({ error: "Select a payment method" }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return Response.json({ error: "Enter a valid amount" }, { status: 400 });

    // Candidate SELL ads (merchant sells, user buys), best price first.
    const allowedCounterparties = await p2pAllowedCounterparties(dbUser.email);
    const candidates = await db.p2PAd.findMany({
      where: {
        side: "SELL",
        isActive: true,
        crypto,
        fiat,
        availableAmount: { gt: 0 },
        paymentMethods: { has: paymentMethod },
        merchant: { userId: { not: dbUser.id } }, // never match the user's own ad
      },
      include: { merchant: { include: { user: { select: { email: true } } } } },
      orderBy: [{ pricePerUnit: "asc" }, { merchant: { completedTrades: "desc" } }],
      take: 25,
    });

    // First ad whose limits cover the amount, has the liquidity, and is tradable.
    const match = candidates.find((ad) => {
      const merchantEmail = ad.merchant.user.email?.trim().toLowerCase() ?? "";
      if (allowedCounterparties && !allowedCounterparties.has(merchantEmail)) return false;
      const price = Number(ad.pricePerUnit);
      if (price <= 0) return false;
      if (amount < Number(ad.minLimit) || amount > Number(ad.maxLimit)) return false;
      if (Number(ad.availableAmount) * price < amount) return false;
      return isP2PAdTradable({
        crypto: ad.crypto,
        pricePerUnit: price,
        availableAmount: Number(ad.availableAmount),
        totalAmount: Number(ad.totalAmount),
        minLimit: Number(ad.minLimit),
        maxLimit: Number(ad.maxLimit),
      });
    });

    if (!match) {
      return Response.json(
        { error: "No merchant available for that amount and payment method right now. Try a different amount." },
        { status: 404 },
      );
    }

    const pairDenied = await p2pPairDeniedResponse(dbUser.email, match.merchant.user.email);
    if (pairDenied) return pairDenied;

    const price        = Number(match.pricePerUnit);
    const cryptoAmount = parseFloat((amount / price).toFixed(8));
    const fiatAmount   = parseFloat((cryptoAmount * price).toFixed(2));

    if (cryptoAmount <= 0 || cryptoAmount > Number(match.availableAmount)) {
      return Response.json({ error: "Amount no longer available — try again" }, { status: 409 });
    }

    // 2026-07-20 hardening: flag buyer↔merchant ring pairs (shared device /
    // prior transfers). Any stored flag forces admin review at release time.
    const ringSignals = await detectP2PRingSignals(db, dbUser.id, match.merchant.userId);

    // Reserve liquidity + open order atomically (SELL ad: merchant crypto already escrowed).
    const order = await db.$transaction(async (tx) => {
      const reserved = await tx.p2PAd.updateMany({
        where: { id: match.id, isActive: true, availableAmount: { gte: cryptoAmount } },
        data:  { availableAmount: { decrement: cryptoAmount } },
      });
      if (reserved.count === 0) throw new Error("INSUFFICIENT_AD_LIQUIDITY");

      // Wallet-backed coin (KES or in-app local coin) SELL ad: escrow per-order
      // from the merchant's own balance. It is not locked up-front like crypto ads.
      if (isWalletBackedCoin(match.crypto)) {
        const lockedAmount = kesLockAmount(cryptoAmount);
        await lockWalletCoin(tx, match.merchant.userId, match.crypto, lockedAmount, {});
        const createdOrder = await tx.p2POrder.create({
          data: {
            adId:          match.id,
            buyerId:       dbUser.id,
            sellerId:      match.merchantId,
            crypto:        match.crypto,
            cryptoAmount,
            fiatAmount,
            pricePerUnit:  price,
            paymentMethod,
            expiresAt:     new Date(Date.now() + match.paymentWindow * 60 * 1000),
            ...(ringSignals.length > 0 ? { riskFlags: ringSignals } : {}),
          },
        });
        await recordWalletCoinMovement(tx, {
          userId: match.merchant.userId,
          crypto: match.crypto,
          amount: lockedAmount,
          action: "lock",
          orderId: createdOrder.id,
          role: "giver",
        });
        await tx.merchantProfile.update({
          where: { id: match.merchantId },
          data: { totalTrades: { increment: 1 } },
        });
        return createdOrder;
      }

      const feeRate = Number(match.feeRate);
      const lockAmount = cryptoAmount * (1 + feeRate);
      await lockUserCrypto(tx, match.merchant.userId, match.crypto, defaultNetwork(match.crypto), lockAmount);

      const createdOrder = await tx.p2POrder.create({
        data: {
          adId:          match.id,
          buyerId:       dbUser.id,
          sellerId:      match.merchantId,
          crypto:        match.crypto,
          cryptoAmount,
          fiatAmount,
          pricePerUnit:  price,
          paymentMethod,
          expiresAt:     new Date(Date.now() + match.paymentWindow * 60 * 1000),
          ...(ringSignals.length > 0 ? { riskFlags: ringSignals } : {}),
        },
      });
      await tx.merchantProfile.update({
        where: { id: match.merchantId },
        data: { totalTrades: { increment: 1 } },
      });
      return createdOrder;
    }).catch((err: unknown) => {
      const msg = (err as Error).message;
      if (msg === "INSUFFICIENT_AD_LIQUIDITY") return null;
      if (msg === "INSUFFICIENT_FIAT_BALANCE") return "INSUFFICIENT_FIAT_BALANCE" as const;
      if (msg === "INSUFFICIENT_CRYPTO_BALANCE") return "INSUFFICIENT_CRYPTO_BALANCE" as const;
      if (msg === "PROMO_LOCKED") return "PROMO_LOCKED" as const;
      if (msg === "NO_DEPOSIT_GATE") return "NO_DEPOSIT_GATE" as const;
      throw err;
    });

    if (order === "PROMO_LOCKED") {
      return Response.json({ error: "That merchant's balance is promo credit that is play-only until they deposit their own funds." }, { status: 409 });
    }
    if (order === "NO_DEPOSIT_GATE") {
      return Response.json({ error: "That merchant hasn't funded their account with a real deposit yet, so this offer can't settle right now." }, { status: 409 });
    }
    if (order === "INSUFFICIENT_FIAT_BALANCE") {
      return Response.json({ error: "That merchant does not have enough fiat wallet balance to back this KES Coin order." }, { status: 409 });
    }
    if (order === "INSUFFICIENT_CRYPTO_BALANCE") {
      return Response.json({ error: `That merchant does not have enough ${match.crypto} balance to back this order right now.` }, { status: 409 });
    }
    if (!order) {
      return Response.json({ error: "That offer was just taken — try again" }, { status: 409 });
    }

    // Wait for Resend to accept the email before this serverless request ends.
    const merchantEmail = match.merchant.user.email;
    if (merchantEmail) {
      const buyerName = dbUser.firstName
        ? `${dbUser.firstName}${dbUser.lastName ? ` ${dbUser.lastName}` : ""}`.trim()
        : dbUser.username ?? "A trader";
      await waitForEmailDelivery("Express new order", [sendNewP2POrderEmail(merchantEmail, match.merchant.displayName, {
        orderId: order.id,
        buyerName,
        crypto: match.crypto,
        cryptoAmount,
        fiatAmount,
        fiat: match.fiat,
        paymentMethod,
        side: "SELL",
      })]);
    }

    return Response.json({
      orderId:      order.id,
      crypto:       match.crypto,
      cryptoAmount,
      fiatAmount,
      pricePerUnit: price,
      merchant:     match.merchant.displayName,
    }, { status: 201 });
  } catch (err) {
    console.error("POST /api/p2p/express:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
