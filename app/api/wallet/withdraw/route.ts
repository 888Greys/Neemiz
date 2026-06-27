import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser, SuspendedAccountError } from "@/lib/get-or-create-user";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { initiateLipaHarakaWithdrawal } from "@/lib/lipaharaka";
import { notifyAdminsLowFloat, notifyAdminsSuspiciousNumber } from "@/lib/admin-alert";
import { WINDOW_MS, dailyLimitKes, dailyCapWhere } from "@/lib/withdrawal-window";
import { CURRENCY_SYMBOL, WITHDRAWAL_FEE_RATE } from "@/lib/currency";
import { withdrawalsDisabledResponse } from "@/lib/withdrawal-guard";

function normalizeMsisdn(phone: string): string {
  const v = phone.trim().replace(/\s+/g, "");
  if (v.startsWith("+254")) return v.slice(1);
  if (v.startsWith("254")) return v;
  if (v.startsWith("0") && v.length === 10) return `254${v.slice(1)}`;
  return v;
}

export async function POST(req: Request) {
  try {
    const killed = await withdrawalsDisabledResponse();
    if (killed) return killed;

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
    const minimumWithdrawal = 100;
    // Daily cap: a user may withdraw at most this much across the day's M-Pesa
    // withdrawals. The window resets at 02:00 EAT (see lib/withdrawal-window).
    const limit = dailyLimitKes();
    if (!Number.isFinite(amountKes) || amountKes < minimumWithdrawal) {
      return Response.json({ error: `Minimum withdrawal is ${CURRENCY_SYMBOL} ${minimumWithdrawal}` }, { status: 400 });
    }
    if (amountKes > limit) {
      return Response.json({ error: `Daily withdrawal limit is ${CURRENCY_SYMBOL} ${limit.toLocaleString()}` }, { status: 400 });
    }
    if (amountKes > 150_000) {
      return Response.json({ error: "Maximum withdrawal is KSh 150,000" }, { status: 400 });
    }
    if (!/^254[17]\d{8}$/.test(msisdn)) {
      return Response.json({ error: "Invalid Safaricom number. Use 07XX or 01XX format." }, { status: 400 });
    }

    const feeRate   = lipaTestMode ? 0 : WITHDRAWAL_FEE_RATE;
    const feeKes    = parseFloat((amountKes * feeRate).toFixed(2));
    const payoutKes = parseFloat((amountKes - feeKes).toFixed(2));

    // ── Step 1: deduct balance + create record atomically ──
    // Gate: amounts > 1,000,000 KES or > 10 withdrawals today require admin approval
    const { withdrawalId, dbUserId, needsApproval, numberTripped, numberCount } = await db.$transaction(async (tx) => {
      const dbUser = await getOrCreateUser(user.id, { email: user.email });

      // Race-safe debit FIRST. The conditional updateMany (walletBalance >=
      // amountKes) takes a row lock on the user, which serializes ALL concurrent
      // cash-outs for this user: a second request blocks here until the first
      // commits. That single lock closes both the balance double-spend AND the
      // daily-cap race — because the cap aggregate below runs only after we hold
      // the lock, it always sees any concurrent withdrawal that committed first.
      // The gte guard is also the DB-level non-negative floor; count === 0 means
      // the balance was insufficient at commit time.
      const debited = await tx.user.updateMany({
        where: { id: dbUser.id, walletBalance: { gte: amountKes } },
        data:  { walletBalance: { decrement: amountKes } },
      });
      if (debited.count === 0) throw new Error("INSUFFICIENT_BALANCE");

      // Rolling-24h cash-out cap, shared across vectors: M-Pesa withdrawals AND
      // outgoing wallet transfers both count (see dailyCapWhere), so a user can't
      // dodge it by routing through an accomplice. Evaluated AFTER the debit so
      // the row lock above has serialized us; if over the cap we throw, rolling
      // back the debit. P2P escrow / crypto are excluded.
      const capWhere = dailyCapWhere(dbUser.id);
      const priorCount = await tx.transaction.count({ where: capWhere });
      const priorSum = await tx.transaction.aggregate({ where: capWhere, _sum: { amount: true } });
      const withdrawnWindow = Number(priorSum._sum?.amount ?? 0);
      if (withdrawnWindow + amountKes > limit) {
        throw new Error(`DAILY_LIMIT:${Math.max(0, limit - withdrawnWindow)}`);
      }

      // Anti-mule: count withdrawals to THIS destination number across ALL
      // users in the rolling 24h window. The per-user cap above does nothing
      // when many accounts funnel cash into one collector number, so if a
      // number is hit repeatedly we hold the payout for approval and alert the
      // owner. Threshold is the Nth withdrawal to the number (default 2 =
      // alert/hold from the 2nd onward). metadata->>msisdn is the dest number.
      const numberThreshold = Math.max(2, Number(process.env.WITHDRAWAL_NUMBER_ALERT_THRESHOLD ?? 2));
      const priorToNumber = await tx.transaction.count({
        where: {
          type:      TransactionType.WITHDRAWAL,
          provider:  "lipaharaka",
          status:    { notIn: [TransactionStatus.FAILED, TransactionStatus.CANCELLED] },
          createdAt: { gte: new Date(Date.now() - WINDOW_MS) },
          metadata:  { path: ["msisdn"], equals: msisdn },
        },
      });
      const numberCount = priorToNumber + 1; // including the one we're about to create
      const numberTripped = numberCount >= numberThreshold;

      const needsApproval = amountKes > 1_000_000 || priorCount >= 10 || numberTripped;
      const txStatus = needsApproval ? ("PENDING_APPROVAL" as TransactionStatus) : TransactionStatus.PENDING;

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

      return { withdrawalId: withdrawal.id, dbUserId: dbUser.id, needsApproval, numberTripped, numberCount };
    });

    // ── Step 2: if approval required, stop here ──
    if (needsApproval) {
      // Alert the owner when a destination number tripped the velocity guard.
      if (numberTripped) {
        notifyAdminsSuspiciousNumber({ msisdn, count: numberCount, amountKes, held: true })
          .catch((e) => console.error("[withdraw] suspicious-number alert failed", e));
      }
      return Response.json({
        ok:           true,
        withdrawalId,
        pendingApproval: true,
        message: amountKes > 1_000_000
          ? "Withdrawals above KSh 1,000,000 require admin approval. Your balance has been held and will be processed within 24 hours."
          : "This withdrawal is pending review and will be processed within 24 hours. Your balance is safe.",
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
          body:   `Your withdrawal of ${CURRENCY_SYMBOL} ${payoutKes.toLocaleString()} is being processed and will arrive shortly via M-Pesa.`,
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
        message:      `Your withdrawal of ${CURRENCY_SYMBOL} ${payoutKes.toLocaleString()} is being processed and will be sent to +${msisdn} shortly. We'll notify you the moment it's on its way — your balance is safe.`,
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
      message:      `${CURRENCY_SYMBOL} ${payoutKes.toLocaleString()} is being sent to +${msisdn} via M-Pesa. You'll be notified once it's confirmed.`,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    }
    if (err instanceof Error && err.message.startsWith("DAILY_LIMIT:")) {
      const remaining = Number(err.message.split(":")[1] ?? 0);
      return Response.json({
        error: remaining > 0
          ? `Daily limit: you can withdraw ${CURRENCY_SYMBOL} ${remaining.toLocaleString()} more today. Resets at 2:00 AM.`
          : "You've reached today's KSh 500 withdrawal limit. It resets at 2:00 AM.",
      }, { status: 400 });
    }
    if (err instanceof SuspendedAccountError) {
      return Response.json({ error: "Your account has been suspended. Contact support." }, { status: 403 });
    }
    console.error("Withdrawal route error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/wallet/withdraw — the caller's M-Pesa daily-limit status, so the UI
 * can show how much is left and when it resets (02:00 EAT).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const limit = dailyLimitKes();

  const capWhere = dailyCapWhere(dbUser.id);
  const sum = await db.transaction.aggregate({ where: capWhere, _sum: { amount: true } });
  // Rolling window: capacity frees up gradually as each withdrawal ages past
  // 24h. The soonest the user regains room is when their OLDEST in-window
  // withdrawal exits, i.e. its createdAt + 24h.
  const oldest = await db.transaction.findFirst({
    where: capWhere,
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const used = Number(sum._sum?.amount ?? 0);
  return Response.json({
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetsAt:  oldest ? new Date(oldest.createdAt.getTime() + WINDOW_MS).toISOString() : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
