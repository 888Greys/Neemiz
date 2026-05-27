import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { relworxSend } from "@/lib/relworx";

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

    if (!Number.isFinite(amountKes) || amountKes < 50) {
      return Response.json({ error: "Minimum withdrawal is KSh 50" }, { status: 400 });
    }
    if (amountKes > 150_000) {
      return Response.json({ error: "Maximum withdrawal is KSh 150,000" }, { status: 400 });
    }
    if (!/^254[17]\d{8}$/.test(msisdn)) {
      return Response.json({ error: "Invalid Safaricom number. Use 07XX or 01XX format." }, { status: 400 });
    }

    const WITHDRAWAL_FEE_RATE = 0.05;
    const feeKes    = parseFloat((amountKes * WITHDRAWAL_FEE_RATE).toFixed(2));
    const payoutKes = parseFloat((amountKes - feeKes).toFixed(2));

    // ── Step 1: deduct balance + create PENDING record atomically ──
    const { withdrawalId, dbUserId } = await db.$transaction(async (tx) => {
      const dbUser = await getOrCreateUser(user.id, { email: user.email });
      const balance = Number(dbUser.walletBalance);

      if (balance < amountKes) throw new Error("INSUFFICIENT_BALANCE");

      await tx.user.update({
        where: { id: dbUser.id },
        data:  { walletBalance: { decrement: amountKes } },
      });

      const withdrawal = await tx.transaction.create({
        data: {
          userId:   dbUser.id,
          type:     TransactionType.WITHDRAWAL,
          amount:   amountKes,
          currency: "KES",
          status:   TransactionStatus.PENDING,
          provider: "relworx",
          metadata: {
            msisdn,
            fee:         feeKes,
            payout:      payoutKes,
            requestedAt: new Date().toISOString(),
          },
        },
      });

      return { withdrawalId: withdrawal.id, dbUserId: dbUser.id };
    });

    // ── Step 2: call Relworx ──
    const accountNo = process.env.RELWORX_ACCOUNT_NO;
    if (!accountNo) {
      // Roll back balance — Relworx not configured
      await db.user.update({ where: { id: dbUserId }, data: { walletBalance: { increment: amountKes } } });
      await db.transaction.update({ where: { id: withdrawalId }, data: { status: TransactionStatus.FAILED } });
      return Response.json({ error: "Payment provider not configured" }, { status: 503 });
    }

    try {
      const result = await relworxSend({
        account_no:  accountNo,
        reference:   withdrawalId,
        msisdn:      `+${msisdn}`,
        currency:    "KES",
        amount:      payoutKes,
        description: `Nezeem withdrawal ${withdrawalId}`,
      });

      // Store Relworx reference for webhook matching
      await db.transaction.update({
        where: { id: withdrawalId },
        data:  { reference: result.reference ?? withdrawalId, metadata: {
          msisdn,
          fee:          feeKes,
          payout:       payoutKes,
          requestedAt:  new Date().toISOString(),
          relworxRef:   result.reference,
          submittedAt:  new Date().toISOString(),
        }},
      });

      return Response.json({
        ok:           true,
        withdrawalId,
        fee:          feeKes,
        payout:       payoutKes,
        message:      `KSh ${payoutKes.toLocaleString()} is on its way to +${msisdn} via M-Pesa.`,
      });
    } catch (apiErr) {
      // Relworx call failed — refund the user immediately
      await db.$transaction([
        db.user.update({ where: { id: dbUserId }, data: { walletBalance: { increment: amountKes } } }),
        db.transaction.update({ where: { id: withdrawalId }, data: { status: TransactionStatus.FAILED } }),
      ]);
      const msg = apiErr instanceof Error ? apiErr.message : "Payment provider error";
      return Response.json({ error: msg }, { status: 502 });
    }
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    }
    console.error("Withdrawal route error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
