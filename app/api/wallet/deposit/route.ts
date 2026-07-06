import { createClient } from "@/lib/supabase/server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { getOrCreateUser, SuspendedAccountError } from "@/lib/get-or-create-user";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { relworxRequestPayment } from "@/lib/relworx";

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

    const rl = rateLimit(`wallet-deposit:${user.id}`, 10, 60_000);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const accountNo = process.env.RELWORX_ACCOUNT_NO;
    if (!accountNo || !process.env.RELWORX_API_KEY) {
      return Response.json({ error: "Payment provider not configured" }, { status: 503 });
    }

    let body: { amountKes: number; phoneNumber: string };
    try { body = await req.json(); }
    catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }

    const { amountKes, phoneNumber } = body;
    const msisdn = normalizeMsisdn(String(phoneNumber ?? ""));

    if (!Number.isFinite(amountKes) || amountKes < 10) {
      return Response.json({ error: "Minimum deposit is KSh 10" }, { status: 400 });
    }
    if (amountKes > 150_000) {
      return Response.json({ error: "Maximum deposit is KSh 150,000" }, { status: 400 });
    }
    if (!/^254[17]\d{8}$/.test(msisdn)) {
      return Response.json({ error: "Invalid Safaricom number. Use 07XXXXXXXX or 01XXXXXXXX." }, { status: 400 });
    }

    // Create PENDING transaction first so we have a reference ID
    const dbUser  = await getOrCreateUser(user.id, { email: user.email });
    const txn     = await db.transaction.create({
      data: {
        userId:   dbUser.id,
        type:     TransactionType.DEPOSIT,
        amount:   amountKes,
        currency: "KES",
        status:   TransactionStatus.PENDING,
        provider: "relworx",
        metadata: { msisdn, requestedAt: new Date().toISOString() },
      },
    });

    // Initiate STK push via Relworx
    try {
      await relworxRequestPayment({
        account_no:  accountNo,
        reference:   txn.id,
        msisdn:      `+${msisdn}`,
        currency:    "KES",
        amount:      amountKes,
        description: `Nezeem deposit ${txn.id}`,
      });
    } catch (apiErr) {
      // Clean up the pending record
      await db.transaction.update({ where: { id: txn.id }, data: { status: TransactionStatus.FAILED } });
      const msg = apiErr instanceof Error ? apiErr.message : "Payment provider error";
      return Response.json({ error: msg }, { status: 502 });
    }

    return Response.json({
      status: "queued",
      message: "Check your phone for the M-Pesa prompt.",
      transactionRequestId: txn.id,
    });
  } catch (err) {
    if (err instanceof SuspendedAccountError) {
      return Response.json({ error: "Your account is temporarily under review. Your balance is safe — we're verifying recent activity and will restore access shortly." }, { status: 403 });
    }
    console.error("Deposit route error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
