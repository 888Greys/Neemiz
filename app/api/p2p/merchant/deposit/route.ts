import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

const VALID_CRYPTOS  = ["USDT", "BTC", "ETH", "BNB"] as const;
const VALID_NETWORKS: Record<string, string[]> = {
  USDT: ["TRC20", "ERC20", "BEP20"],
  BTC:  ["BTC"],
  ETH:  ["ERC20"],
  BNB:  ["BEP20"],
};

// GET /api/p2p/merchant/deposit — list the merchant's own crypto deposit requests
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser   = await getOrCreateUser(user.id, { email: user.email });
    const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
    if (!merchant) return Response.json({ error: "Merchant account required" }, { status: 403 });

    const deposits = await db.p2PCryptoDeposit.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(deposits);
  } catch (err) {
    console.error("GET /api/p2p/merchant/deposit:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/p2p/merchant/deposit — submit a new crypto deposit request
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser   = await getOrCreateUser(user.id, { email: user.email });
    const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
    if (!merchant) return Response.json({ error: "Merchant account required" }, { status: 403 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { crypto, amount, txHash, network } = body as {
      crypto:   string;
      amount:   number;
      txHash?:  string;
      network?: string;
    };

    if (!crypto || !VALID_CRYPTOS.includes(crypto as typeof VALID_CRYPTOS[number])) {
      return Response.json({ error: `Unsupported crypto. Must be one of: ${VALID_CRYPTOS.join(", ")}` }, { status: 400 });
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return Response.json({ error: "Invalid amount" }, { status: 400 });
    }

    const resolvedNetwork = network ?? VALID_NETWORKS[crypto][0];
    if (!VALID_NETWORKS[crypto].includes(resolvedNetwork)) {
      return Response.json({
        error: `Invalid network for ${crypto}. Must be one of: ${VALID_NETWORKS[crypto].join(", ")}`,
      }, { status: 400 });
    }

    const deposit = await db.p2PCryptoDeposit.create({
      data: {
        merchantId: merchant.id,
        crypto,
        amount:     amountNum,
        txHash:     txHash ?? null,
        network:    resolvedNetwork,
        status:     "PENDING",
      },
    });

    return Response.json(deposit, { status: 201 });
  } catch (err) {
    console.error("POST /api/p2p/merchant/deposit:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
