import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionType, TransactionStatus } from "@prisma/client";

function normalizeMsisdn(phone: string): string {
  const v = phone.trim().replace(/\s+/g, "");
  if (v.startsWith("+254")) return v.slice(1);
  if (v.startsWith("254")) return v;
  if (v.startsWith("0") && v.length === 10) return `254${v.slice(1)}`;
  return v;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let body: { amountKes: number; phoneNumber: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { amountKes, phoneNumber } = body;
    const msisdn = normalizeMsisdn(String(phoneNumber ?? ""));

    if (!Number.isFinite(amountKes) || amountKes < 100) {
      return Response.json({ error: "Minimum withdrawal is KSh 100" }, { status: 400 });
    }
    if (amountKes > 150_000) {
      return Response.json({ error: "Maximum withdrawal is KSh 150,000" }, { status: 400 });
    }
    if (!/^254[17]\d{8}$/.test(msisdn)) {
      return Response.json({ error: "Invalid Safaricom number. Use 07XX or 01XX format." }, { status: 400 });
    }

    // 5% withdrawal fee — deducted from the requested amount.
    // User requests amountKes, receives (amountKes * 0.95) via M-Pesa.
    const WITHDRAWAL_FEE_RATE = 0.05;
    const feeKes    = parseFloat((amountKes * WITHDRAWAL_FEE_RATE).toFixed(2));
    const payoutKes = parseFloat((amountKes - feeKes).toFixed(2));

    const result = await db.$transaction(async (tx) => {
      const dbUser = await getOrCreateUser(user.id, { email: user.email });
      const balance = Number(dbUser.walletBalance);

      if (balance < amountKes) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const updated = await tx.user.update({
        where: { id: dbUser.id },
        data: { walletBalance: { decrement: amountKes } },
        select: { walletBalance: true },
      });

      const withdrawal = await tx.transaction.create({
        data: {
          userId: dbUser.id,
          type: TransactionType.WITHDRAWAL,
          amount: amountKes,
          currency: "KES",
          status: TransactionStatus.PENDING,
          provider: "megapay",
          metadata: { msisdn, requestedAt: new Date().toISOString(), fee: feeKes, payout: payoutKes },
        },
      });

      return { newBalance: Number(updated.walletBalance), withdrawalId: withdrawal.id };
    });

    return Response.json({
      ok: true,
      newBalance: result.newBalance,
      withdrawalId: result.withdrawalId,
      fee: feeKes,
      payout: payoutKes,
      message: `KSh ${payoutKes.toLocaleString()} will be sent to your M-Pesa (5% fee: KSh ${feeKes.toLocaleString()}).`,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    }
    console.error("Withdrawal route error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
