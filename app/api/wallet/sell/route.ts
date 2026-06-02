import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser, SuspendedAccountError } from "@/lib/get-or-create-user";
import { getSpotRate } from "@/lib/p2p/spot";
import { TransactionType, TransactionStatus } from "@prisma/client";

export const runtime = "nodejs";

// Cryptos a user can sell their KES into. Must have a CoinGecko spot rate
// (see lib/p2p/spot.ts) AND be withdrawable from the wallet.
const SELL_CRYPTOS = ["USDT", "USDC", "BTC", "ETH", "BNB"];

const MIN_KES = 200;
const MAX_KES = 150_000;
const SELL_FEE_RATE = 0.05; // 5% spread, matches M-Pesa + crypto withdrawal fees

/**
 * POST /api/wallet/sell
 * Body: { amountKes, crypto, network, address }
 *
 * Sells the user's KES wallet balance for crypto. M-Pesa (KES) payout is
 * unavailable, so this is the cash-out path: KES is debited and held, a
 * PENDING_APPROVAL payout request is created, and an admin sends the crypto
 * manually (see /api/admin/withdrawals/[id]) before marking it complete.
 * Rejecting refunds the held KES.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let body: { amountKes: number; crypto: string; network: string; address: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const amountKes = Number(body.amountKes);
    const crypto    = String(body.crypto ?? "").toUpperCase();
    const network   = String(body.network ?? "").toUpperCase();
    const address   = String(body.address ?? "").trim();

    // ── Validation ──────────────────────────────────────────────────────────
    if (!Number.isFinite(amountKes) || amountKes < MIN_KES) {
      return Response.json({ error: `Minimum is KSh ${MIN_KES.toLocaleString()}` }, { status: 400 });
    }
    if (amountKes > MAX_KES) {
      return Response.json({ error: `Maximum is KSh ${MAX_KES.toLocaleString()}` }, { status: 400 });
    }
    if (!SELL_CRYPTOS.includes(crypto)) {
      return Response.json({ error: "Unsupported crypto" }, { status: 400 });
    }
    if (!network) {
      return Response.json({ error: "Network is required" }, { status: 400 });
    }
    if (address.length < 20) {
      return Response.json({ error: "Enter a valid destination address" }, { status: 400 });
    }

    // ── Live rate (KES per 1 crypto) ─────────────────────────────────────────
    const rate = await getSpotRate(crypto, "KES");
    if (!rate || rate <= 0) {
      return Response.json({ error: "Live rate unavailable right now — try again shortly" }, { status: 503 });
    }

    const feeKes      = parseFloat((amountKes * SELL_FEE_RATE).toFixed(2));
    const netKes      = parseFloat((amountKes - feeKes).toFixed(2));
    const cryptoAmount = parseFloat((netKes / rate).toFixed(8));
    if (!Number.isFinite(cryptoAmount) || cryptoAmount <= 0) {
      return Response.json({ error: "Amount too small for this crypto" }, { status: 400 });
    }

    // ── Debit + hold KES, create pending-approval payout (atomic) ────────────
    const { saleId } = await db.$transaction(async (tx) => {
      const dbUser  = await getOrCreateUser(user.id, { email: user.email });
      const balance = Number(dbUser.walletBalance);
      if (balance < amountKes) throw new Error("INSUFFICIENT_BALANCE");

      await tx.user.update({
        where: { id: dbUser.id },
        data:  { walletBalance: { decrement: amountKes } },
      });

      const sale = await tx.transaction.create({
        data: {
          userId:   dbUser.id,
          type:     TransactionType.WITHDRAWAL,
          amount:   amountKes,
          currency: "KES",
          status:   TransactionStatus.PENDING_APPROVAL,
          provider: "crypto_sell",
          metadata: {
            crypto,
            network,
            address,
            rate,
            cryptoAmount,
            feeKes,
            requestedAt: new Date().toISOString(),
          },
        },
      });

      return { saleId: sale.id };
    });

    return Response.json({
      ok:              true,
      saleId,
      pendingApproval: true,
      crypto,
      network,
      rate,
      cryptoAmount,
      feeKes,
      message: `Your KSh ${amountKes.toLocaleString()} is held. We'll send ≈ ${cryptoAmount} ${crypto} to your address shortly.`,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
      return Response.json({ error: "Insufficient KES balance" }, { status: 400 });
    }
    if (err instanceof SuspendedAccountError) {
      return Response.json({ error: "Your account has been suspended. Contact support." }, { status: 403 });
    }
    console.error("Sell route error:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
