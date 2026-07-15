import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { p2pBlockedResponse } from "@/lib/p2p/user-guard";
import { isP2PAdTradable, validateP2PAd } from "@/lib/p2p/ad-guards";
import { autoApproveIfDue } from "@/lib/p2p/merchant-approval";
import { isKesCoin, isWalletBackedCoin, defaultNetwork, kesLockAmount, p2pFeeRate, p2pMakerLock, lockUserCrypto } from "@/lib/p2p/crypto-balance";
import { AdSide } from "@prisma/client";
import { sendAdCreatedEmail } from "@/lib/brevo";
import { FIAT_CURRENCIES, DEFAULT_FIAT } from "@/lib/p2p/currencies";
import { assertKesSellBacking } from "@/lib/p2p/ad-backing";
import { ACTIVE_LOCAL_COIN_CODES, isActiveLocalCoin } from "@/lib/p2p/local-coins";
import { getFxRatesToKES } from "@/lib/p2p/fx";
import { fundLocalCoinShortfallFromKes, reservedKesForMerchant } from "@/lib/p2p/local-coin-convert";

// Real cryptos plus every active in-app local coin (KES, UG, TZ, …). Local coins
// are 1:1-pegged in-app currencies that trade over the same escrow rails.
const VALID_CRYPTOS = [...new Set(["USDT", "USDC", "BTC", "ETH", "BNB", ...ACTIVE_LOCAL_COIN_CODES])];
const VALID_SIDES: AdSide[] = ["BUY", "SELL"];
const VALID_FIATS = new Set(FIAT_CURRENCIES.map((f) => f.code));

// GET /api/p2p/ads — browse ads (public)
export async function GET(req: Request) {
  try {
    const url    = new URL(req.url);
    const side   = url.searchParams.get("side") as AdSide | null;
    const crypto = url.searchParams.get("crypto");
    const payment = url.searchParams.get("payment");
    const fiat   = url.searchParams.get("fiat");

    const ads = await db.p2PAd.findMany({
      where: {
        isActive: true,
        ...(side && VALID_SIDES.includes(side) ? { side } : {}),
        ...(crypto && VALID_CRYPTOS.includes(crypto) ? { crypto } : {}),
        ...(fiat && VALID_FIATS.has(fiat) ? { fiat } : {}),
        ...(payment ? { paymentMethods: { has: payment } } : {}),
        availableAmount: { gt: 0 },
      },
      include: {
        merchant: {
          select: {
            id:             true,
            displayName:    true,
            avatarUrl:      true,
            lastSeenAt:     true,
            totalTrades:     true,
            completedTrades: true,
            completionRate: true,
            avgReleaseTime: true,
            createdAt:       true,
            user: { select: { imageUrl: true } },
          },
        },
      },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 50,
    });

    const tradableAds = ads.filter((ad) => isP2PAdTradable({
      crypto: ad.crypto,
      pricePerUnit: Number(ad.pricePerUnit),
      availableAmount: Number(ad.availableAmount),
      totalAmount: Number(ad.totalAmount),
      minLimit: Number(ad.minLimit),
      maxLimit: Number(ad.maxLimit),
    }));

    return Response.json(tradableAds.map((ad) => {
      const totalTrades = ad.merchant.totalTrades;
      const completedTrades = ad.merchant.completedTrades;
      const completionRate = totalTrades > 0 ? (completedTrades / totalTrades) * 100 : 0;

      return {
      id:              ad.id,
      side:            ad.side,
      crypto:          ad.crypto,
      fiat:            ad.fiat,
      featured:        ad.featured,
      pricePerUnit:    Number(ad.pricePerUnit),
      availableAmount: Number(ad.availableAmount),
      minLimit:        Number(ad.minLimit),
      maxLimit:        Number(ad.maxLimit),
      paymentMethods:  ad.paymentMethods,
      paymentWindow:   ad.paymentWindow,
      terms:           ad.terms,
      merchant: {
        id:              ad.merchant.id,
        displayName:     ad.merchant.displayName,
        // Prefer merchant upload, else Google/email account photo.
        avatarUrl:       ad.merchant.avatarUrl ?? ad.merchant.user.imageUrl,
        // Online = a heartbeat in the last 3 minutes.
        isOnline:        !!ad.merchant.lastSeenAt && (Date.now() - new Date(ad.merchant.lastSeenAt).getTime() < 3 * 60 * 1000),
        totalTrades,
        completedTrades,
        completionRate,
        avgReleaseTime:  ad.merchant.avgReleaseTime,
        joinedAt:        ad.merchant.createdAt.toISOString(),
      },
    };
    }), { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=60" } });
  } catch (err) {
    console.error("GET /api/p2p/ads:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/p2p/ads — merchant creates ad
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser   = await getOrCreateUser(user.id, { email: user.email });

    const p2pDenied = await p2pBlockedResponse(dbUser.email);
    if (p2pDenied) return p2pDenied;
    const found    = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
    const merchant = found ? await autoApproveIfDue(found) : null;
    if (!merchant?.isVerified) return Response.json({ error: "Merchant account required" }, { status: 403 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { side, crypto, fiat, pricePerUnit, totalAmount, minLimit, maxLimit, paymentMethods, paymentWindow, terms } = body;

    // Payment methods are OPTIONAL: a merchant may post an ad without listing
    // any and agree the payment rail with the buyer in chat.
    if (!side || !crypto || pricePerUnit == null || totalAmount == null) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!VALID_SIDES.includes(side as AdSide)) {
      return Response.json({ error: "Invalid side" }, { status: 400 });
    }
    if (!VALID_CRYPTOS.includes(crypto as string)) {
      return Response.json({ error: "Unsupported crypto" }, { status: 400 });
    }
    // Payment methods are optional — the field may be omitted entirely, so
    // default to an empty list rather than assuming an array (avoids a 500).
    const requestedPaymentMethods = Array.from(new Set(
      (Array.isArray(paymentMethods) ? paymentMethods : []).filter((method): method is string => typeof method === "string"),
    ));
    const savedPaymentMethods = await db.p2PPaymentMethod.findMany({
      where: { merchantId: merchant.id, isActive: true },
      select: { name: true },
    });
    const savedPaymentCodes = new Set(savedPaymentMethods.map((method) => method.name).filter(Boolean));
    const missingPaymentMethods = requestedPaymentMethods.filter((method) => !savedPaymentCodes.has(method));
    // No saved methods is fine — the ad simply carries none and payment is
    // arranged in chat. If the merchant DID list methods, they must be saved.
    if (missingPaymentMethods.length > 0) {
      return Response.json({ error: "This ad uses a payment method that is not saved in your Merchant Center." }, { status: 400 });
    }
    const fiatCode = typeof fiat === "string" && VALID_FIATS.has(fiat) ? fiat : DEFAULT_FIAT;
    if (side === "SELL" && (minLimit == null || maxLimit == null)) {
      return Response.json({ error: "Missing order limits" }, { status: 400 });
    }

    // KES Coin is a 1:1-pegged stablecoin, but merchants may set a spread on top
    // (their cash-in/out rate) — e.g. 1.05 = +5%. The on-platform escrow is
    // amount-based (lib/p2p/crypto-balance), so the price only sets how much fiat
    // the buyer pays the merchant. Use the merchant's price for every asset.
    const pricePerUnitNum  = Number(pricePerUnit);
    const totalAmountNum   = Number(totalAmount);
    const paymentWindowNum = Number(paymentWindow ?? 15);

    if (!Number.isFinite(pricePerUnitNum) || pricePerUnitNum <= 0)
      return Response.json({ error: "Invalid price per unit" }, { status: 400 });
    // Guard against fat-fingering a 1:1-pegged local coin like a crypto (e.g. 130)
    // — keep its spread within ±100% of the 1:1 peg.
    if (isActiveLocalCoin(crypto as string) && (pricePerUnitNum < 0.5 || pricePerUnitNum > 2))
      return Response.json({ error: `${(crypto as string).toUpperCase()} Coin price must be between 0.50 and 2.00 (max ±100% spread on the 1:1 peg).` }, { status: 400 });
    if (!Number.isFinite(totalAmountNum) || totalAmountNum <= 0)
      return Response.json({ error: "Invalid total amount" }, { status: 400 });

    // Order limits apply to BOTH sides now. If a side omits them, default to
    // the full order value (legacy behaviour for BUY ads without limits).
    const fullOrderLimit = totalAmountNum * pricePerUnitNum;
    const minLimitNum = minLimit != null && minLimit !== "" ? Number(minLimit) : fullOrderLimit;
    const maxLimitNum = maxLimit != null && maxLimit !== "" ? Number(maxLimit) : fullOrderLimit;

    if (!Number.isFinite(minLimitNum) || minLimitNum <= 0)
      return Response.json({ error: "Invalid minimum limit" }, { status: 400 });
    if (!Number.isFinite(maxLimitNum) || maxLimitNum <= 0 || maxLimitNum < minLimitNum)
      return Response.json({ error: "Maximum limit must be greater than or equal to minimum" }, { status: 400 });
    if (!Number.isFinite(paymentWindowNum) || paymentWindowNum < 5 || paymentWindowNum > 180)
      return Response.json({ error: "Payment window must be 5–180 minutes" }, { status: 400 });

    const guardError = validateP2PAd({
      crypto: crypto as string,
      pricePerUnit: pricePerUnitNum,
      availableAmount: totalAmountNum,
      totalAmount: totalAmountNum,
      minLimit: minLimitNum,
      maxLimit: maxLimitNum,
    });
    if (guardError) return Response.json({ error: guardError }, { status: 400 });

    const adData = {
      merchantId:      merchant.id,
      side:            side as AdSide,
      crypto:          crypto as string,
      fiat:            fiatCode,
      pricePerUnit:    pricePerUnitNum,
      totalAmount:     totalAmountNum,
      availableAmount: totalAmountNum,
      minLimit:        minLimitNum,
      maxLimit:        maxLimitNum,
      paymentMethods:  requestedPaymentMethods,
      paymentWindow:   paymentWindowNum,
      terms:           (terms as string | undefined) ?? null,
    };

    if (side === "SELL" && isKesCoin(crypto as string)) {
      const backing = await assertKesSellBacking({
        merchantId: merchant.id,
        walletBalance: Number(dbUser.walletBalance ?? 0),
        crypto: crypto as string,
        side: side as AdSide,
        availableAmount: totalAmountNum,
      });
      if (backing) {
        return Response.json({
          error: `Insufficient backing. Your active KES sell ads plus this ad require KSh ${backing.required.toLocaleString("en-KE")}, but your wallet has KSh ${backing.available.toLocaleString("en-KE")}.`,
        }, { status: 400 });
      }
    }

    // In-app local coin (non-KES) SELL ad: escrowed per order from the merchant's
    // own UserCryptoBalance. Merchants may fund any shortfall from free fiat KES
    // at live FX so one KES balance can back NGN/UGX/… sell ads.
    if (side === "SELL" && isWalletBackedCoin(crypto as string) && !isKesCoin(crypto as string)) {
      const need = kesLockAmount(totalAmountNum);
      const rates = await getFxRatesToKES();
      const reservedKes = await reservedKesForMerchant(merchant.id);
      const funded = await db.$transaction(async (tx) => {
        try {
          await fundLocalCoinShortfallFromKes(tx, {
            userId: dbUser.id,
            crypto: crypto as string,
            needAmount: need,
            reservedKes,
            toKES: rates.toKES,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          if (
            msg === "INSUFFICIENT_FIAT_BALANCE" ||
            msg === "PROMO_LOCKED" ||
            msg === "NO_DEPOSIT_GATE" ||
            msg === "NO_FX_RATE"
          ) {
            return msg;
          }
          throw err;
        }
        const net = defaultNetwork(crypto as string);
        const bal = await tx.userCryptoBalance.findUnique({
          where: { userId_crypto_network: { userId: dbUser.id, crypto: crypto as string, network: net } },
          select: { available: true },
        });
        if (Number(bal?.available ?? 0) < need) return "INSUFFICIENT_COIN";
        return null;
      });

      if (funded === "NO_FX_RATE") {
        return Response.json({ error: `No FX rate available for ${crypto}. Try again shortly.` }, { status: 503 });
      }
      if (funded === "PROMO_LOCKED") {
        return Response.json({
          error: "Promo credit cannot fund cross-market sell ads. Deposit real funds first.",
        }, { status: 400 });
      }
      if (funded === "NO_DEPOSIT_GATE") {
        return Response.json({
          error: "Make a deposit with your own funds before selling in-app coins on P2P.",
        }, { status: 400 });
      }
      if (funded === "INSUFFICIENT_FIAT_BALANCE" || funded === "INSUFFICIENT_COIN") {
        return Response.json({
          error: `Insufficient balance. This sell ad needs ${need} ${crypto} (amount + 1% fee). Top up KES or hold ${crypto} — your free KES converts at live FX.`,
        }, { status: 400 });
      }
    }

    // On-chain crypto SELL ads lock the listed amount (+ platform fee) in the
    // merchant's UserCryptoBalance at create time — one wallet, no separate escrow.
    if (side === "SELL" && !isWalletBackedCoin(crypto as string)) {
      const feeRate    = p2pFeeRate();
      const lockAmount = p2pMakerLock(totalAmountNum, feeRate);
      const network    = defaultNetwork(crypto as string);
      const ad = await db.$transaction(async (tx) => {
        try {
          await lockUserCrypto(tx, dbUser.id, crypto as string, network, lockAmount);
        } catch (err) {
          if ((err as Error).message === "INSUFFICIENT_CRYPTO_BALANCE") throw new Error("INSUFFICIENT_BALANCE");
          throw err;
        }
        return tx.p2PAd.create({ data: { ...adData, feeRate } });
      }).catch((err: unknown) => {
        if ((err as Error).message === "INSUFFICIENT_BALANCE") return null;
        throw err;
      });

      if (!ad) {
        return Response.json({
          error: `Insufficient ${crypto} in your wallet — you need ${lockAmount} ${crypto} (amount + ${(feeRate * 100).toFixed(0)}% fee). Deposit first.`,
        }, { status: 400 });
      }
      if (dbUser.email) {
        sendAdCreatedEmail(dbUser.email, merchant.displayName, {
          side: side as "BUY" | "SELL",
          crypto: crypto as string,
          totalAmount: totalAmountNum,
          pricePerUnit: pricePerUnitNum,
          fiat: fiatCode,
          minLimit: minLimitNum,
          maxLimit: maxLimitNum,
          adId: ad.id,
        }).catch((e) => console.error("Ad created email failed:", e));
      }
      return Response.json(ad, { status: 201 });
    }

    const ad = await db.p2PAd.create({ data: adData });
    if (dbUser.email) {
      sendAdCreatedEmail(dbUser.email, merchant.displayName, {
        side: side as "BUY" | "SELL",
        crypto: crypto as string,
        totalAmount: totalAmountNum,
        pricePerUnit: pricePerUnitNum,
        fiat: fiatCode,
        minLimit: minLimitNum,
        maxLimit: maxLimitNum,
        adId: ad.id,
      }).catch((e) => console.error("Ad created email failed:", e));
    }
    return Response.json(ad, { status: 201 });
  } catch (err) {
    console.error("POST /api/p2p/ads:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
