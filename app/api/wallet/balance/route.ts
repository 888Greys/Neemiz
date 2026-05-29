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
      email: user.email,
      phone: user.phone,
      username: user.user_metadata?.username,
      firstName: user.user_metadata?.first_name,
      lastName: user.user_metadata?.last_name,
    });

    // Build crypto balances from transaction history — no external RPC needed.
    // Groups all completed crypto deposits by coin+network and sums amounts.
    const cryptoTxns = await db.transaction.findMany({
      where: {
        userId:   dbUser.id,
        provider: "crypto",
        type:     "DEPOSIT",
        status:   "COMPLETED",
      },
      select: { metadata: true },
    });

    // Sum crypto amounts by coin+network
    const cryptoMap: Record<string, { crypto: string; network: string; available: number }> = {};
    for (const tx of cryptoTxns) {
      const meta = tx.metadata as Record<string, unknown> | null;
      if (!meta) continue;
      const crypto  = String(meta.crypto  ?? "");
      const network = String(meta.network ?? "");
      const amount  = Number(meta.cryptoAmount ?? 0);
      if (!crypto || !network || amount <= 0) continue;
      const key = `${crypto}:${network}`;
      cryptoMap[key] ??= { crypto, network, available: 0 };
      cryptoMap[key].available += amount;
    }

    // Sync to user_crypto_balances table (upsert each)
    for (const bal of Object.values(cryptoMap)) {
      await db.userCryptoBalance.upsert({
        where:  { userId_crypto_network: { userId: dbUser.id, crypto: bal.crypto, network: bal.network } },
        create: { userId: dbUser.id, crypto: bal.crypto, network: bal.network, available: bal.available, locked: 0 },
        update: { available: bal.available },
      }).catch(() => {});
    }

    const cryptoBalances = Object.values(cryptoMap);

    return Response.json({
      balance:        Number(dbUser.walletBalance),
      currency:       dbUser.currency,
      cryptoBalances: cryptoBalances.map((b) => ({
        crypto:    b.crypto,
        network:   b.network,
        available: b.available,
        locked:    0,
      })),
    });
  } catch (err) {
    console.error("Wallet balance route error:", err);
    return Response.json({ error: "Could not fetch balance" }, { status: 500 });
  }
}
