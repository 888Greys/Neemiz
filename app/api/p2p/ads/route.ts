import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { AdSide } from "@prisma/client";

const VALID_CRYPTOS = ["USDT", "BTC", "ETH", "BNB"];
const VALID_SIDES: AdSide[] = ["BUY", "SELL"];

// GET /api/p2p/ads — browse ads (public)
export async function GET(req: Request) {
  try {
    const url    = new URL(req.url);
    const side   = url.searchParams.get("side") as AdSide | null;
    const crypto = url.searchParams.get("crypto");
    const payment = url.searchParams.get("payment");

    const ads = await db.p2PAd.findMany({
      where: {
        isActive: true,
        ...(side && VALID_SIDES.includes(side) ? { side } : {}),
        ...(crypto && VALID_CRYPTOS.includes(crypto) ? { crypto } : {}),
        ...(payment ? { paymentMethods: { has: payment } } : {}),
        availableAmount: { gt: 0 },
      },
      include: {
        merchant: {
          select: {
            displayName:    true,
            isOnline:       true,
            completedTrades: true,
            completionRate: true,
            avgReleaseTime: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return Response.json(ads.map((ad) => ({
      id:              ad.id,
      side:            ad.side,
      crypto:          ad.crypto,
      fiat:            ad.fiat,
      pricePerUnit:    Number(ad.pricePerUnit),
      availableAmount: Number(ad.availableAmount),
      minLimit:        Number(ad.minLimit),
      maxLimit:        Number(ad.maxLimit),
      paymentMethods:  ad.paymentMethods,
      paymentWindow:   ad.paymentWindow,
      terms:           ad.terms,
      merchant: {
        displayName:     ad.merchant.displayName,
        isOnline:        ad.merchant.isOnline,
        completedTrades: ad.merchant.completedTrades,
        completionRate:  Number(ad.merchant.completionRate),
        avgReleaseTime:  ad.merchant.avgReleaseTime,
      },
    })));
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
    const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
    if (!merchant?.isVerified) return Response.json({ error: "Merchant account required" }, { status: 403 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { side, crypto, pricePerUnit, totalAmount, minLimit, maxLimit, paymentMethods, paymentWindow, terms } = body;

    if (!side || !crypto || pricePerUnit == null || totalAmount == null || minLimit == null || maxLimit == null || !(paymentMethods as unknown[])?.length) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!VALID_SIDES.includes(side as AdSide)) {
      return Response.json({ error: "Invalid side" }, { status: 400 });
    }
    if (!VALID_CRYPTOS.includes(crypto as string)) {
      return Response.json({ error: "Unsupported crypto" }, { status: 400 });
    }

    const pricePerUnitNum  = Number(pricePerUnit);
    const totalAmountNum   = Number(totalAmount);
    const minLimitNum      = Number(minLimit);
    const maxLimitNum      = Number(maxLimit);
    const paymentWindowNum = Number(paymentWindow ?? 15);

    if (!Number.isFinite(pricePerUnitNum) || pricePerUnitNum <= 0)
      return Response.json({ error: "Invalid price per unit" }, { status: 400 });
    if (!Number.isFinite(totalAmountNum) || totalAmountNum <= 0)
      return Response.json({ error: "Invalid total amount" }, { status: 400 });
    if (!Number.isFinite(minLimitNum) || minLimitNum <= 0)
      return Response.json({ error: "Invalid minimum limit" }, { status: 400 });
    if (!Number.isFinite(maxLimitNum) || maxLimitNum <= 0 || maxLimitNum < minLimitNum)
      return Response.json({ error: "Maximum limit must be greater than or equal to minimum" }, { status: 400 });
    if (!Number.isFinite(paymentWindowNum) || paymentWindowNum < 5 || paymentWindowNum > 180)
      return Response.json({ error: "Payment window must be 5–180 minutes" }, { status: 400 });

    const adData = {
      merchantId:      merchant.id,
      side:            side as AdSide,
      crypto:          crypto as string,
      pricePerUnit:    pricePerUnitNum,
      totalAmount:     totalAmountNum,
      availableAmount: totalAmountNum,
      minLimit:        minLimitNum,
      maxLimit:        maxLimitNum,
      paymentMethods:  paymentMethods as string[],
      paymentWindow:   paymentWindowNum,
      terms:           (terms as string | undefined) ?? null,
    };

    if (side === "SELL") {
      // Lock balance + create ad atomically — if ad creation fails, balance stays intact
      const ad = await db.$transaction(async (tx) => {
        const balance = await tx.p2PCryptoBalance.findUnique({
          where: { merchantId_crypto: { merchantId: merchant.id, crypto: crypto as string } },
        });
        if (!balance || Number(balance.available) < totalAmountNum) {
          throw new Error("INSUFFICIENT_BALANCE");
        }
        await tx.p2PCryptoBalance.update({
          where: { merchantId_crypto: { merchantId: merchant.id, crypto: crypto as string } },
          data: {
            locked:    { increment: totalAmountNum },
            available: { decrement: totalAmountNum },
          },
        });
        return tx.p2PAd.create({ data: adData });
      }).catch((err: unknown) => {
        if ((err as Error).message === "INSUFFICIENT_BALANCE") return null;
        throw err;
      });

      if (!ad) return Response.json({ error: `Insufficient ${crypto} balance. Deposit first.` }, { status: 400 });
      return Response.json(ad, { status: 201 });
    }

    const ad = await db.p2PAd.create({ data: adData });
    return Response.json(ad, { status: 201 });
  } catch (err) {
    console.error("POST /api/p2p/ads:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
