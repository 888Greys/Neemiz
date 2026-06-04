import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, {
      email:     user.email,
      phone:     user.phone,
      username:  user.user_metadata?.username,
      firstName: user.user_metadata?.first_name,
      lastName:  user.user_metadata?.last_name,
    });

    // ── Blockchain crypto balances from UserCryptoBalance table ───────────────
    // KES Coin is fiat-backed by walletBalance, so legacy KES/KES rows are hidden.
    const rows = await db.userCryptoBalance.findMany({
      where:   { userId: dbUser.id, NOT: { crypto: "KES", network: "KES" } },
      orderBy: { crypto: "asc" },
    });

    // Filter out zero balances for cleaner UI
    const cryptoBalances = rows
      .filter((r) => Number(r.available) > 0 || Number(r.locked) > 0)
      .map((r) => ({
        crypto:    r.crypto,
        network:   r.network,
        available: Number(r.available),
        locked:    Number(r.locked),
      }));

    return Response.json({
      balance:        Number(dbUser.walletBalance),
      currency:       dbUser.currency,
      cryptoBalances,
    });
  } catch (err) {
    console.error("Wallet balance route error:", err);
    return Response.json({ error: "Could not fetch balance" }, { status: 500 });
  }
}
