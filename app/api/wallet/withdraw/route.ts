import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser, SuspendedAccountError } from "@/lib/get-or-create-user";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { initiateLipaHarakaWithdrawal } from "@/lib/lipaharaka";
import { notifyAdminsLowFloat } from "@/lib/admin-alert";

function normalizeMsisdn(phone: string): string {
  const v = phone.trim().replace(/\s+/g, "");
  if (v.startsWith("+254")) return v.slice(1);
  if (v.startsWith("254")) return v;
  if (v.startsWith("0") && v.length === 10) return `254${v.slice(1)}`;
  return v;
}

export async function POST(req: Request) {
  try {
    if (process.env.LIPAHARAKA_WITHDRAWALS_ENABLED !== "true") {
      return Response.json({ error: "M-Pesa withdrawals are temporarily paused for reconciliation." }, { status: 503 });
    }

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

    const lipaTestMode = process.env.LIPAHARAKA_TEST_MODE === "true";
    const minimumWithdrawal = lipaTestMode ? 11 : 50;
    // Daily cap: a user may withdraw at most this much (summed across all of the
    // day's M-Pesa withdrawals). Configurable; defaults to KSh 500.
    const parsedDailyLimit = Number(process.env.WITHDRAWAL_DAILY_LIMIT_KES ?? "500");
    const dailyLimitKes = Number.isFinite(parsedDailyLimit) && parsedDailyLimit > 0 ? parsedDailyLimit : 500;
    if (!Number.isFinite(amountKes) || amountKes < minimumWithdrawal) {
      return Response.json({ error: `Minimum withdrawal is KSh ${minimumWithdrawal}` }, { status: 400 });
    }
    if (amountKes > dailyLimitKes) {
      return Response.json({ error: `Daily withdrawal limit is KSh ${dailyLimitKes.toLocaleString()}` }, { status: 400 });
    }
    if (amountKes > 150_000) {
      return Response.json({ error: "Maximum withdrawal is KSh 150,000" }, { status: 400 });
    }
    if (!/^254[17]\d{8}$/.test(msisdn)) {
      return Response.json({ error: "Invalid Safaricom number. Use 07XX or 01XX format." }, { status: 400 });
    }

    const WITHDRAWAL_FEE_RATE = lipaTestMode ? 0 : 0.05;
    const feeKes    = parseFloat((amountKes * WITHDRAWAL_FEE_RATE).toFixed(2));
    const payoutKes = parseFloat((amountKes - feeKes).toFixed(2));

    // ── Step 1: deduct balance + create record atomically ──
    // Gate: amounts > 1,000,000 KES or > 10 withdrawals today require admin approval
    const { withdrawalId, dbUserId, needsApproval } = await db.$transaction(async (tx) => {
      const dbUser = await getOrCreateUser(user.id, { email: user.email });
      const balance = Number(dbUser.walletBalance);

      if (balance < amountKes) throw new Error("INSUFFICIENT_BALANCE");

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todayWhere = {
        userId: dbUser.id,
        type:   TransactionType.WITHDRAWAL,
        status: { notIn: [TransactionStatus.FAILED, TransactionStatus.CANCELLED] },
        createdAt: { gte: startOfDay },
      };
      const todayCount = await tx.transaction.count({ where: todayWhere });

      // Enforce the daily cap atomically: sum of today's withdrawals (refunds
      // excluded — FAILED/CANCELLED are filtered above) plus this one must not
      // exceed the limit. Checked inside the transaction so two concurrent
      // requests can't both slip under the cap.
      const todaySum = await tx.transaction.aggregate({ where: todayWhere, _sum: { amount: true } });
      const withdrawnToday = Number(todaySum._sum?.amount ?? 0);
      if (withdrawnToday + amountKes > dailyLimitKes) {
        const remaining = Math.max(0, dailyLimitKes - withdrawnToday);
        throw new Error(`DAILY_LIMIT:${remaining}`);
      }

      const needsApproval = amountKes > 1_000_000 || todayCount >= 10;
      const txStatus = needsApproval ? ("PENDING_APPROVAL" as TransactionStatus) : TransactionStatus.PENDING;

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
          status:   txStatus,
          provider: "lipaharaka",
          metadata: {
            msisdn,
            fee:         feeKes,
            payout:      payoutKes,
            requestedAt: new Date().toISOString(),
          },
        },
      });

      return { withdrawalId: withdrawal.id, dbUserId: dbUser.id, needsApproval };
    });

    // ── Step 2: if approval required, stop here ──
    if (needsApproval) {
      return Response.json({
        ok:           true,
        withdrawalId,
        pendingApproval: true,
        message: amountKes > 1_000_000
          ? "Withdrawals above KSh 1,000,000 require admin approval. Your balance has been held and will be processed within 24 hours."
          : "You have reached the daily withdrawal limit. This withdrawal is pending admin approval and will be processed within 24 hours.",
      });
    }

    // ── Step 3: call Lipa Haraka ──
    if (!process.env.LIPAHARAKA_API_KEY || !Number.isInteger(payoutKes)) {
      // Roll back balance — Relworx not configured
      await db.user.update({ where: { id: dbUserId }, data: { walletBalance: { increment: amountKes } } });
      await db.transaction.update({ where: { id: withdrawalId }, data: { status: TransactionStatus.FAILED } });
      return Response.json({ error: "Payment provider not configured" }, { status: 503 });
    }

    let ack;
    try {
      ack = await initiateLipaHarakaWithdrawal(msisdn, payoutKes);
    } catch (apiErr) {
      // Transport failure — no response from Lipa, so it never received the
      // request. Safe to refund immediately.
      await db.$transaction([
        db.user.update({ where: { id: dbUserId }, data: { walletBalance: { increment: amountKes } } }),
        db.transaction.update({ where: { id: withdrawalId }, data: { status: TransactionStatus.FAILED } }),
      ]);
      const msg = apiErr instanceof Error ? apiErr.message : "Payment provider error";
      return Response.json({ error: msg }, { status: 502 });
    }

    if (!ack.accepted) {
      const reason = (ack.message ?? "").toLowerCase();
      // A genuine customer-input error (bad number etc.) should be surfaced and
      // refunded. Anything else — most importantly insufficient float/liquidity —
      // is a platform-side problem the customer shouldn't be punished for.
      const userInputError = ["invalid", "msisdn", "number", "format", "wrong", "not registered", "unauthor", "duplicate", "not allowed", "phone"].some((s) => reason.includes(s));

      if (userInputError) {
        await db.$transaction([
          db.user.update({ where: { id: dbUserId }, data: { walletBalance: { increment: amountKes } } }),
          db.transaction.update({ where: { id: withdrawalId }, data: { status: TransactionStatus.FAILED } }),
        ]);
        return Response.json({ error: ack.message ?? "Withdrawal was rejected. Please check your M-Pesa number and try again." }, { status: 502 });
      }

      // Insufficient float / temporary provider issue: DON'T refund. Hold the
      // funds, queue the payout, reassure the customer, and alert the owner to
      // top up. The process-queued-withdrawals cron auto-sends it once funded.
      await db.transaction.update({
        where: { id: withdrawalId },
        data:  {
          status:   TransactionStatus.PENDING,
          metadata: {
            msisdn,
            fee:          feeKes,
            payout:       payoutKes,
            requestedAt:  new Date().toISOString(),
            queued:       true,
            queuedReason: ack.message ?? "insufficient_float",
            queuedAt:     new Date().toISOString(),
          },
        },
      });
      await db.notification.create({
        data: {
          userId: dbUserId,
          type:   "withdrawal_processing",
          title:  "Withdrawal is processing",
          body:   `Your withdrawal of KSh ${payoutKes.toLocaleString()} is being processed and will arrive shortly via M-Pesa.`,
          link:   "/wallet",
        },
      }).catch(() => {});
      await notifyAdminsLowFloat({ amountKes: payoutKes, msisdn }).catch((e) => console.error("[withdraw] low-float alert failed", e));

      return Response.json({
        ok:           true,
        withdrawalId,
        queued:       true,
        fee:          feeKes,
        payout:       payoutKes,
        message:      `Your withdrawal of KSh ${payoutKes.toLocaleString()} is being processed and will be sent to +${msisdn} shortly. We'll notify you the moment it's on its way — your balance is safe.`,
      });
    }

    // Accepted (async). Lipa is now processing; the final paid/failed outcome
    // arrives via the callback webhook. Keep the withdrawal PENDING — do NOT
    // refund here (that double-pays when Lipa later disburses). The provider
    // reference is often null until PROCESSING, so the webhook also matches on
    // msisdn + payout amount.
    await db.transaction.update({
      where: { id: withdrawalId },
      data:  {
        reference: ack.reference ?? undefined,
        metadata: {
          msisdn,
          fee:          feeKes,
          payout:       payoutKes,
          requestedAt:  new Date().toISOString(),
          lipaWithdrawalId: ack.reference,
          submittedAt:  new Date().toISOString(),
        },
      },
    });

    return Response.json({
      ok:           true,
      withdrawalId,
      fee:          feeKes,
      payout:       payoutKes,
      message:      `KSh ${payoutKes.toLocaleString()} is being sent to +${msisdn} via M-Pesa. You'll be notified once it's confirmed.`,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    }
    if (err instanceof Error && err.message.startsWith("DAILY_LIMIT:")) {
      const remaining = Number(err.message.split(":")[1] ?? 0);
      return Response.json({
        error: remaining > 0
          ? `Daily withdrawal limit reached. You can withdraw KSh ${remaining.toLocaleString()} more today.`
          : "You've reached today's withdrawal limit. Please try again tomorrow.",
      }, { status: 400 });
    }
    if (err instanceof SuspendedAccountError) {
      return Response.json({ error: "Your account has been suspended. Contact support." }, { status: 403 });
    }
    console.error("Withdrawal route error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
