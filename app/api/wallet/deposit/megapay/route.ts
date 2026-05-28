import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { db } from "@/lib/db";

const MEGAPAY_BASE_URL    = (process.env.MEGAPAY_BASE_URL ?? "").replace(/\/+$/, "");
const MEGAPAY_API_KEY     = process.env.MEGAPAY_API_KEY ?? "";
const MEGAPAY_EMAIL       = process.env.MEGAPAY_EMAIL ?? "";
const APP_URL             = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
// Use explicit callback URL if set, otherwise build from APP_URL
const MEGAPAY_CALLBACK_URL = process.env.MEGAPAY_CALLBACK_URL
  ? process.env.MEGAPAY_CALLBACK_URL
  : `${APP_URL}/api/wallet/deposit/megapay/callback`;

function normaliseMsisdn(phone: string): string {
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

    if (!MEGAPAY_BASE_URL || !MEGAPAY_API_KEY || !MEGAPAY_EMAIL) {
      return Response.json({ error: "Payment gateway not configured" }, { status: 503 });
    }

    let body: { phone: string; amount: number };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { phone, amount } = body;
    if (!phone || !amount) {
      return Response.json({ error: "Phone and amount are required" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 10 || amount > 150000) {
      return Response.json({ error: "Amount must be between KSh 10 and KSh 150,000" }, { status: 400 });
    }

    const msisdn = normaliseMsisdn(phone);
    if (!/^254[17]\d{8}$/.test(msisdn)) {
      return Response.json({ error: "Invalid Safaricom number. Use 07XX or 01XX format." }, { status: 400 });
    }

    const dbUser = await getOrCreateUser(user.id, { email: user.email });

    // Create a pending transaction first to get a local reference ID
    const transaction = await db.transaction.create({
      data: {
        userId:   dbUser.id,
        type:     "DEPOSIT",
        amount,
        currency: "KES",
        status:   "PENDING",
        provider: "megapay",
        metadata: { msisdn },
      },
    });

    const mpRes = await fetch(`${MEGAPAY_BASE_URL}/backend/v1/initiatestk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key:  MEGAPAY_API_KEY,
        email:    MEGAPAY_EMAIL,
        amount:   String(Math.round(amount)),
        msisdn,
        reference: transaction.id,
        callback: MEGAPAY_CALLBACK_URL,
      }),
    });

    const data = await mpRes.json().catch(() => ({})) as Record<string, unknown>;

    if (!mpRes.ok || data.success !== "200" || !data.transaction_request_id) {
      await db.transaction.update({ where: { id: transaction.id }, data: { status: "FAILED" } });
      const msg = (data.massage ?? data.message ?? `MegaPay error (${mpRes.status})`) as string;
      return Response.json({ error: msg }, { status: 502 });
    }

    await db.transaction.update({
      where: { id: transaction.id },
      data:  { reference: data.transaction_request_id as string },
    });

    return Response.json({
      success:           true,
      transactionId:     transaction.id,
      providerRequestId: data.transaction_request_id,
    });
  } catch (err) {
    console.error("MegaPay deposit error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
