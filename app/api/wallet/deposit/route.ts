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

    const baseUrl = (
      process.env.NEZEEM_MEGAPAY_BASE_URL ??
      process.env.ACEGIRLS_MEGAPAY_BASE_URL ??
      process.env.MEGAPAY_BASE_URL ??
      process.env.MEGAPAY_API_URL ??
      ""
    ).replace(/\/+$/, "");
    const apiKey = process.env.NEZEEM_MEGAPAY_API_KEY ?? process.env.ACEGIRLS_MEGAPAY_API_KEY ?? process.env.MEGAPAY_API_KEY ?? "";
    const email = process.env.NEZEEM_MEGAPAY_EMAIL ?? process.env.ACEGIRLS_MEGAPAY_EMAIL ?? process.env.MEGAPAY_EMAIL ?? "";
    const callbackUrl = process.env.NEZEEM_MEGAPAY_CALLBACK_URL ?? process.env.ACEGIRLS_MEGAPAY_CALLBACK_URL ?? process.env.MEGAPAY_CALLBACK_URL ?? "";
    const callbackToken =
      process.env.NEZEEM_MEGAPAY_CALLBACK_TOKEN ?? process.env.ACEGIRLS_MEGAPAY_CALLBACK_TOKEN ?? process.env.MEGAPAY_CALLBACK_TOKEN ?? "";

    if (!baseUrl || !apiKey || !email) {
      return Response.json({ error: "MegaPay not configured" }, { status: 503 });
    }

    let body: { amountKes: number; phoneNumber: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { amountKes, phoneNumber } = body;
    const msisdn = normalizeMsisdn(String(phoneNumber ?? ""));

    if (!Number.isFinite(amountKes) || amountKes < 10) {
      return Response.json({ error: "Minimum deposit is KSh 10" }, { status: 400 });
    }
    if (!/^254[17]\d{8}$/.test(msisdn)) {
      return Response.json({ error: "Invalid Safaricom number. Use 07XXXXXXXX or 01XXXXXXXX." }, { status: 400 });
    }

    const reference = `nezeem-dep-${user.id.slice(0, 8)}-${Date.now()}`;

    const mpRes = await fetch(`${baseUrl}/backend/v1/initiatestk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        email,
        amount: String(amountKes),
        msisdn,
        reference,
        ...(callbackUrl   ? { callback:       callbackUrl }   : {}),
        ...(callbackToken ? { callback_token: callbackToken } : {}),
      }),
    });

    const mpData = await mpRes.json().catch(() => ({})) as Record<string, string>;

    if (!mpRes.ok || mpData.success !== "200" || !mpData.transaction_request_id) {
      return Response.json(
        { error: mpData.massage ?? mpData.message ?? "MegaPay rejected the request." },
        { status: 400 }
      );
    }

    try {
      const dbUser = await getOrCreateUser(user.id, { email: user.email });
      await db.transaction.create({
        data: {
          userId: dbUser.id,
          type: TransactionType.DEPOSIT,
          amount: amountKes,
          currency: "KES",
          status: TransactionStatus.PENDING,
          reference: mpData.transaction_request_id,
          provider: "megapay",
          metadata: { msisdn, reference },
        },
      });
    } catch (ledgerErr) {
      console.error("Deposit ledger write failed:", ledgerErr);
    }

    return Response.json({
      status: "queued",
      message: "Check your phone for the M-Pesa prompt.",
      transactionRequestId: mpData.transaction_request_id,
    });
  } catch (err) {
    console.error("Deposit route error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
