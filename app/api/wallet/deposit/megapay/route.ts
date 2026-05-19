import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

const MEGAPAY_BASE_URL = (process.env.MEGAPAY_BASE_URL ?? "").replace(/\/+$/, "");
const MEGAPAY_API_KEY = process.env.MEGAPAY_API_KEY ?? "";
const MEGAPAY_EMAIL = process.env.MEGAPAY_EMAIL ?? "";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

function normaliseMsisdn(phone: string): string {
  const v = phone.trim().replace(/\s+/g, "");
  if (v.startsWith("+254")) return v.slice(1);
  if (v.startsWith("254")) return v;
  if (v.startsWith("0") && v.length === 10) return `254${v.slice(1)}`;
  return v;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

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
  // Safaricom Kenya: 2547XXXXXXXX or 2541XXXXXXXX
  if (!/^254[17]\d{8}$/.test(msisdn)) {
    return Response.json({ error: "Invalid Safaricom number. Use 07XX or 01XX format." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  // Create a pending transaction to get a reference ID
  const transaction = await db.transaction.create({
    data: {
      userId: user.id,
      type: "DEPOSIT",
      amount,
      currency: "KES",
      status: "PENDING",
      provider: "megapay",
      metadata: { msisdn },
    },
  });

  try {
    const mpRes = await fetch(`${MEGAPAY_BASE_URL}/backend/v1/initiatestk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: MEGAPAY_API_KEY,
        email: MEGAPAY_EMAIL,
        amount: String(Math.round(amount)),
        msisdn,
        reference: transaction.id,
        callback: `${APP_URL}/api/wallet/deposit/megapay/callback`,
      }),
    });

    const data = await mpRes.json().catch(() => ({})) as Record<string, unknown>;

    if (!mpRes.ok || data.success !== "200" || !data.transaction_request_id) {
      await db.transaction.update({ where: { id: transaction.id }, data: { status: "FAILED" } });
      const msg = (data.massage ?? data.message ?? `MegaPay error (${mpRes.status})`) as string;
      return Response.json({ error: msg }, { status: 502 });
    }

    // Save the MegaPay transaction_request_id so we can poll status
    await db.transaction.update({
      where: { id: transaction.id },
      data: { reference: data.transaction_request_id as string },
    });

    return Response.json({
      success: true,
      transactionId: transaction.id,
      providerRequestId: data.transaction_request_id,
    });
  } catch (err) {
    await db.transaction.update({ where: { id: transaction.id }, data: { status: "FAILED" } });
    console.error("MegaPay STK error:", err);
    return Response.json({ error: "Failed to reach payment gateway" }, { status: 502 });
  }
}
