import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getOrCreateDepositAddress } from "@/lib/crypto/hd-wallet";
import { VALID_CRYPTO_DEPOSIT_NETWORKS } from "@/lib/wallet-deposit-options";

export const dynamic = "force-dynamic";

// SECURITY 2026-06-20: seed compromised, deposits frozen until rotation.
// Fail-closed so even returning a stored address (which would send funds to a
// drained, bot-watched address) is blocked. See memory: neemiz-seed-compromise.
const DEPOSITS_ENABLED = process.env.CRYPTO_DEPOSITS_ENABLED === "true";
const DEPOSITS_DISABLED_MSG =
  "Crypto deposits are temporarily disabled for security maintenance. Please check back soon.";

const VALID = VALID_CRYPTO_DEPOSIT_NETWORKS;

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
  if (!DEPOSITS_ENABLED) return Response.json({ error: DEPOSITS_DISABLED_MSG }, { status: 503 });

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
  if (!DEPOSITS_ENABLED) return Response.json({ error: DEPOSITS_DISABLED_MSG }, { status: 503 });

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
    const msg = err instanceof Error ? err.message : String(err);
    console.error("crypto/address POST:", msg);
    // Surface the real error so the client can show it (e.g. "MASTER_XPUB_EVM is not set")
    return Response.json({ error: msg ?? "Failed to generate address" }, { status: 500 });
  }
}
