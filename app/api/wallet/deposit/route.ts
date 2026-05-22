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

function stringValue(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function providerMessage(data: Record<string, unknown>, fallback: string) {
  return stringValue(data, ["massage", "message", "Message", "ResultDesc", "error", "Error"]) || fallback;
}

async function readProviderJson(res: Response) {
  const raw = await res.text().catch(() => "");
  try {
    return { data: raw ? JSON.parse(raw) as Record<string, unknown> : {}, raw };
  } catch {
    return { data: {}, raw };
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const baseUrl = (
      process.env.MEGAPAY_BASE_URL ??
      process.env.MEGAPAY_API_URL ??
      process.env.NEZEEM_MEGAPAY_BASE_URL ??
      process.env.ACEGIRLS_MEGAPAY_BASE_URL ??
      ""
    ).replace(/\/+$/, "");
    const apiKey = process.env.MEGAPAY_API_KEY ?? process.env.NEZEEM_MEGAPAY_API_KEY ?? process.env.ACEGIRLS_MEGAPAY_API_KEY ?? "";
    const email = process.env.MEGAPAY_EMAIL ?? process.env.NEZEEM_MEGAPAY_EMAIL ?? process.env.ACEGIRLS_MEGAPAY_EMAIL ?? "";
    const callbackUrl = process.env.MEGAPAY_CALLBACK_URL ?? process.env.NEZEEM_MEGAPAY_CALLBACK_URL ?? process.env.ACEGIRLS_MEGAPAY_CALLBACK_URL ?? "";
    const callbackToken =
      process.env.MEGAPAY_CALLBACK_TOKEN ?? process.env.NEZEEM_MEGAPAY_CALLBACK_TOKEN ?? process.env.ACEGIRLS_MEGAPAY_CALLBACK_TOKEN ?? "";

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

    const reference = `neemiz-yea-${Date.now()}`;

    const payload: Record<string, string> = {
      api_key: apiKey,
      email,
      amount: String(Math.round(amountKes)),
      msisdn,
      reference,
    };
    if (callbackUrl) payload.callback = callbackUrl;
    if (callbackToken) payload.callback_token = callbackToken;

    const mpRes = await fetch(`${baseUrl}/backend/v1/initiatestk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const { data: mpData, raw: mpRaw } = await readProviderJson(mpRes);
    const providerRequestId = stringValue(mpData, [
      "transaction_request_id",
      "transactionRequestId",
      "TransactionRequestID",
      "TransactionRequestId",
      "request_id",
      "RequestID",
    ]);
    const successCode = stringValue(mpData, ["success", "Success", "status", "Status"]);
    const successBool = mpData["success"] === true || mpData["Success"] === true;
    const queued = providerRequestId && (
      successBool ||
      successCode === "200" ||
      successCode.toLowerCase() === "success" ||
      successCode.toLowerCase() === "queued" ||
      successCode.toLowerCase() === "true"
    );

    if (!providerRequestId) {
      const fallback = mpRaw ? `MegaPay rejected the request: ${mpRaw.slice(0, 180)}` : "MegaPay rejected the request.";
      console.error("MegaPay deposit rejected: status", mpRes.status);
      return Response.json(
        { error: providerMessage(mpData, fallback) },
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
          reference: providerRequestId,
          provider: "megapay",
          metadata: { msisdn, reference },
        },
      });
    } catch (ledgerErr) {
      console.error("Deposit ledger write failed:", ledgerErr instanceof Error ? ledgerErr.message : "Unknown error");
    }

    return Response.json({
      status: "queued",
      message: "Check your phone for the M-Pesa prompt.",
      transactionRequestId: providerRequestId,
    });
  } catch (err) {
    console.error("Deposit route error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
