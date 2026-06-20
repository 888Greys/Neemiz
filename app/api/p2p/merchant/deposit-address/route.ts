import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getOrCreateDepositAddress, DepositsDisabledError } from "@/lib/crypto/hd-wallet";

export const dynamic = "force-dynamic";

const VALID: Record<string, string[]> = {
  USDT: ["TRC20", "ERC20", "BEP20"],
  ETH:  ["ERC20"],
  BNB:  ["BEP20"],
};

// GET /api/p2p/merchant/deposit-address?crypto=USDT&network=TRC20
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser   = await getOrCreateUser(user.id, { email: user.email });
    const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
    if (!merchant) return Response.json({ error: "Merchant account required" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const crypto  = (searchParams.get("crypto")  ?? "USDT").toUpperCase();
    const network = (searchParams.get("network") ?? "TRC20").toUpperCase();

    if (!VALID[crypto] || !VALID[crypto].includes(network)) {
      return Response.json(
        { error: `Invalid combination. Supported: USDT(TRC20/ERC20/BEP20), ETH(ERC20), BNB(BEP20)` },
        { status: 400 },
      );
    }

    const address = await getOrCreateDepositAddress(dbUser.id, crypto, network);
    return Response.json({ address, crypto, network });
  } catch (err) {
    console.error("deposit-address GET:", err instanceof Error ? err.message : err);
    if (err instanceof DepositsDisabledError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    return Response.json({ error: "Failed to get deposit address" }, { status: 500 });
  }
}
