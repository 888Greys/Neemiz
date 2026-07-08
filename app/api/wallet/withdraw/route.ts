import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser, SuspendedAccountError } from "@/lib/get-or-create-user";
import { DEV_AUTH_ENABLED } from "@/lib/dev-auth";
import { verifyStepUpToken, STEPUP_COOKIE } from "@/lib/step-up";
import { TransactionType, TransactionStatus, Prisma } from "@prisma/client";
import { initiateLipaHarakaWithdrawal } from "@/lib/lipaharaka";
import { notifyAdminsSuspiciousNumber } from "@/lib/admin-alert";
import { isMuleFlagged, notifyAdminsMuleHold } from "@/lib/mule-guard";
import { WINDOW_MS, dailyLimitKes, dailyCapWhere } from "@/lib/withdrawal-window";
import { CURRENCY_SYMBOL, WITHDRAWAL_FEE_RATE } from "@/lib/currency";
import { withdrawalsDisabledResponse, setWithdrawalsDisabled } from "@/lib/withdrawal-guard";
import { assertLedgerBacked, LedgerUnbackedError } from "@/lib/ledger-guard";
import { isTwilioConfigured } from "@/lib/twilio";

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

    const dbUser = await getOrCreateUser(user.id, { email: user.email });

    const killed = await withdrawalsDisabledResponse();
    if (killed && !dbUser.isAdmin) return killed;

    // Phone-verification gate. A user must verify a mobile number by SMS (Twilio
    // Verify) before their FIRST withdrawal; that number is then bound to the
    // account for life (see the msisdn-match check below and verify-otp). The
    // gate only bites when Twilio is actually configured — a Twilio outage or
    // missing env must never lock everyone out of their money. Admins exempt.
    if (isTwilioConfigured() && !dbUser.isAdmin && !dbUser.phoneVerified) {
      return Response.json(
        { needsPhoneVerification: true, error: "Verify your phone number to withdraw." },
        { status: 409 },
      );
    }

    if (process.env.LIPAHARAKA_WITHDRAWALS_ENABLED !== "true" && !dbUser.isAdmin) {
      return Response.json({ error: "M-Pesa withdrawals are temporarily paused for reconciliation." }, { status: 503 });
    }

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
    if (!dbUser.isAdmin && amountKes > limit) {
      return Response.json({ error: `Daily withdrawal limit is ${CURRENCY_SYMBOL} ${limit.toLocaleString()}` }, { status: 400 });
    }
    if (!dbUser.isAdmin && amountKes > 150_000) {
      return Response.json({ error: "Maximum withdrawal is KSh 150,000" }, { status: 400 });
    }
    if (!/^254[17]\d{8}$/.test(msisdn)) {
      return Response.json({ error: "Invalid Safaricom number. Use 07XX or 01XX format." }, { status: 400 });
    }

    // ── Server-side step-up gate ──
    // Require a fresh, server-minted password/passkey proof (set by the
    // /api/auth/stepup/* routes). This is what makes "Confirm it's you"
    // enforceable — a direct POST here that skips the confirm UI is rejected,
    // not merely discouraged. Consumed on use (single confirm → one withdrawal).
    // Skipped under dev-auth (no real Supabase session locally).
    if (!DEV_AUTH_ENABLED) {
      const jar = await cookies();
      const proof = jar.get(STEPUP_COOKIE)?.value;
      if (!verifyStepUpToken(proof, user.id)) {
        return Response.json(
          { error: "Please confirm it's you to withdraw.", stepUpRequired: true },
          { status: 401 },
        );
      }
      jar.delete(STEPUP_COOKIE);
    }

    // Bound-number enforcement — TWILIO-INDEPENDENT. Each account is locked to a
    // single M-Pesa withdrawal number for life, whether or not SMS verification
    // is available:
    //   • if a number is already bound (via first withdrawal, the mpesa route, or
    //     SMS verify), cash-outs may ONLY go to it — no editing/rerouting;
    //   • otherwise the FIRST withdrawal binds this number to the account.
    // The number is also unique per account (User.phone @unique), so it can't be
    // shared across accounts. Admins are exempt (they test to arbitrary numbers).
    if (!dbUser.isAdmin) {
      if (dbUser.phone) {
        if (msisdn !== dbUser.phone) {
          return Response.json(
            { error: `Withdrawals can only be sent to your registered number +${dbUser.phone}. Contact support to change it.` },
            { status: 400 },
          );
        }
      } else {
        try {
          await db.user.update({ where: { id: dbUser.id }, data: { phone: msisdn } });
        } catch (bindErr) {
          if (bindErr instanceof Prisma.PrismaClientKnownRequestError && bindErr.code === "P2002") {
            return Response.json({ error: "This M-Pesa number is already registered to another account." }, { status: 409 });
          }
          throw bindErr;
        }
      }
    }

    const feeRate   = lipaTestMode ? 0 : WITHDRAWAL_FEE_RATE;
    // Lipa Haraka B2C only disburses WHOLE shillings, so the payout must be an
    // integer. Floor the payout (i.e. round the fee UP to the next shilling) so
    // we never send more than the net-of-fee amount. Enabling the 13% fee turned
    // most payouts fractional (150 → 130.50), which previously tripped the
    // integer guard below and surfaced as "Payment provider not configured".
    const payoutKes = Math.floor(amountKes * (1 - feeRate));
    const feeKes    = parseFloat((amountKes - payoutKes).toFixed(2));

    // Suspected-mule watchlist: don't block — HOLD the withdrawal for admin
    // review and page the owner (approve a real win, reject laundering).
    const isMule = !dbUser.isAdmin && (await isMuleFlagged(dbUser.email));

    // ── Step 1: deduct balance + create record atomically ──
    // Gate: amounts > 1,000,000 KES or > 10 withdrawals today require admin approval
    const { withdrawalId, dbUserId, needsApproval, numberTripped, numberCount, killTripped, distinctUsers } = await db.$transaction(async (tx) => {
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

      // Ledger-backed balance guard. The balance debit above only proves the
      // wallet_balance column is high enough — but that column can be written
      // directly in the DB with no transaction record (the 2026-06-29 injection
      // incident). Refuse to pay out more than the transaction ledger can
      // account for, so phantom/injected balance can never leave the platform
      // even if DB credentials are compromised. Applies to everyone incl. admins
      // (legit admin balances are backed by BONUS/manual ledger rows).
      await assertLedgerBacked(tx, dbUser.id, amountKes);

      // Rolling-24h cash-out cap, shared across vectors: M-Pesa withdrawals AND
      // outgoing wallet transfers both count (see dailyCapWhere), so a user can't
      // dodge it by routing through an accomplice. Evaluated AFTER the debit so
      // the row lock above has serialized us; if over the cap we throw, rolling
      // back the debit. P2P escrow / crypto are excluded.
      let priorCount = 0;
      if (!dbUser.isAdmin) {
        const capWhere = dailyCapWhere(dbUser.id);
        priorCount = await tx.transaction.count({ where: capWhere });
        const priorSum = await tx.transaction.aggregate({ where: capWhere, _sum: { amount: true } });
        const withdrawnWindow = Number(priorSum._sum?.amount ?? 0);
        if (withdrawnWindow + amountKes > limit) {
          throw new Error(`DAILY_LIMIT:${Math.max(0, limit - withdrawnWindow)}`);
        }
      }

      // (Removed the "a number may receive cash only once, ever" rule — the
      // per-account daily limit plus the locked, unique withdrawal number
      // already bound each account to one number and cap its cash-out, so the
      // once-per-number block only blocked legitimate repeat withdrawals to a
      // user's own line.)

      const numberCount = 0;
      const numberTripped = false;
      const distinctUsers = 0;
      const killTripped = false;

      const needsApproval = isMule || (!dbUser.isAdmin && (amountKes > 1_000_000 || priorCount >= 10));
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

      return { withdrawalId: withdrawal.id, dbUserId: dbUser.id, needsApproval, numberTripped, numberCount, killTripped, distinctUsers };
    });

    // ── Step 1b: strong trigger — auto-disable ALL withdrawals ──
    // Flip the instant kill switch so no further payouts go out until the owner
    // reviews. This withdrawal is already held (needsApproval) above.
    if (killTripped) {
      await setWithdrawalsDisabled(true).catch((e) => console.error("[withdraw] auto kill-switch failed", e));
      notifyAdminsSuspiciousNumber({ msisdn, count: numberCount, amountKes, held: true, autoKilled: true, distinctUsers })
        .catch((e) => console.error("[withdraw] auto-kill alert failed", e));
    }

    // ── Step 2: if approval required, stop here ──
    if (needsApproval) {
      // Alert the owner when a destination number tripped the velocity guard
      // (skip if we already sent the stronger auto-kill alert above).
      if (numberTripped && !killTripped) {
        notifyAdminsSuspiciousNumber({ msisdn, count: numberCount, amountKes, held: true })
          .catch((e) => console.error("[withdraw] suspicious-number alert failed", e));
      }
      // Page admins that a flagged (suspected-mule) account's withdrawal is held.
      if (isMule) {
        notifyAdminsMuleHold({ username: dbUser.username ?? dbUser.id.slice(0, 8), amountKes, msisdn })
          .catch((e) => console.error("[withdraw] mule-hold alert failed", e));
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

      // Insufficient float / temporary provider issue: we no longer hold the
      // funds and auto-retry. Refund the customer immediately, mark the
      // withdrawal FAILED, and surface a maintenance message.
      await db.$transaction([
        db.user.update({ where: { id: dbUserId }, data: { walletBalance: { increment: amountKes } } }),
        db.transaction.update({
          where: { id: withdrawalId },
          data:  {
            status:   TransactionStatus.FAILED,
            metadata: {
              msisdn,
              fee:          feeKes,
              payout:       payoutKes,
              requestedAt:  new Date().toISOString(),
              failedReason: ack.message ?? "insufficient_float",
              failedAt:     new Date().toISOString(),
            },
          },
        }),
      ]);

      return Response.json({
        error: "M-Pesa withdrawals are temporarily unavailable for maintenance. Your balance has not been deducted — please try again later.",
      }, { status: 503 });
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
    if (err instanceof LedgerUnbackedError) {
      // The requested amount exceeds the ledger-backed balance — i.e. part of
      // this wallet_balance has no transaction history behind it. Refuse and
      // alert; do NOT reveal the mechanism to the client.
      console.error(
        `[withdraw] LEDGER_UNBACKED blocked: backed=${err.backed} requested=${err.requested}`,
      );
      return Response.json(
        { error: "This withdrawal could not be processed. Please contact support." },
        { status: 403 },
      );
    }
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
      return Response.json({ error: "Your account is temporarily under review. Your balance is safe — we're verifying recent activity and will restore access shortly." }, { status: 403 });
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

  // Phone-verification state for the withdraw UI: whether the SMS gate applies,
  // whether this user has passed it, and the number they're locked to (prefilled
  // and read-only in the form).
  const phoneVerifyRequired = isTwilioConfigured();
  const phoneVerified = Boolean(dbUser.phoneVerified);
  const boundPhone = dbUser.phone ?? null;

  if (dbUser.isAdmin) {
    return Response.json({
      limit: 999999,
      used: 0,
      remaining: 999999,
      resetsAt: null,
      phoneVerifyRequired,
      phoneVerified,
      boundPhone,
    }, { headers: { "Cache-Control": "no-store" } });
  }

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
    phoneVerifyRequired,
    phoneVerified,
    boundPhone,
  }, { headers: { "Cache-Control": "no-store" } });
}
