import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getOrCreateDepositAddress } from "@/lib/crypto/hd-wallet";

export const dynamic = "force-dynamic";

const VALID: Record<string, string[]> = {
  USDT:  ["TRC20", "ERC20", "BEP20"],
  USDC:  ["ERC20", "POLYGON"],
  ETH:   ["ERC20"],
  BNB:   ["BEP20"],
  MATIC: ["POLYGON"],
  TRX:   ["TRC20"],
  DAI:   ["ERC20"],
  BUSD:  ["BEP20"],
  WBTC:  ["ERC20"],
  LINK:  ["ERC20"],
};

function defaultNetwork(crypto: string): string {
  return VALID[crypto]?.[0] ?? "TRC20";
}

/**
 * GET /api/crypto/address?crypto=USDT&network=TRC20
 * Returns the user's existing deposit address for this crypto/network.
 *
 * POST /api/crypto/address
 * Body: { crypto: "USDT", network: "TRC20" }
 * Generates (or returns) the user's unique HD wallet deposit address.
 */

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser   = await getOrCreateUser(user.id, { email: user.email });
  const { searchParams } = new URL(req.url);
  const crypto   = (searchParams.get("crypto")  ?? "USDT").toUpperCase();
  const network  = (searchParams.get("network") ?? defaultNetwork(crypto)).toUpperCase();

  const existing = await db.cryptoDepositAddress.findUnique({
    where: { userId_crypto_network: { userId: dbUser.id, crypto, network } },
  });

  if (!existing) return Response.json(null);
  return Response.json({ address: existing.address, crypto, network, createdAt: existing.createdAt });
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });

    let body: { crypto?: string; network?: string };
    try   { body = await req.json(); }
    catch { body = {}; }

    const crypto  = (body.crypto  ?? "USDT").toUpperCase();
    const network = (body.network ?? defaultNetwork(crypto)).toUpperCase();

    if (!VALID[crypto] || !VALID[crypto].includes(network)) {
      const supported = Object.entries(VALID).map(([c, nets]) => `${c}(${nets.join("/")})`).join(", ");
      return Response.json({ error: `Invalid crypto/network. Supported: ${supported}` }, { status: 400 });
    }

    const address = await getOrCreateDepositAddress(dbUser.id, crypto, network);

    return Response.json({ address, crypto, network }, { status: 201 });
  } catch (err) {
    console.error("crypto/address POST:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Failed to generate address" }, { status: 500 });
  }
}
