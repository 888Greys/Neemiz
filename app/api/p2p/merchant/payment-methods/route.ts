import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { ALL_PAYMENT_CODES } from "@/lib/p2p/payment-methods";
import { PaymentType } from "@prisma/client";

// Codes that represent a bank account (need a bank name); everything else is
// treated as a mobile-money / wallet rail (needs a phone/number).
const BANK_CODES = new Set(["BANK", "KUDA", "FNB", "CAPITEC"]);

async function merchantFor(userId: string) {
  return db.merchantProfile.findUnique({ where: { userId } });
}

// GET /api/p2p/merchant/payment-methods — the merchant's saved payout details
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    const merchant = await merchantFor(dbUser.id);
    if (!merchant) return Response.json([], { status: 200 });

    const methods = await db.p2PPaymentMethod.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, type: true, name: true, accountName: true, accountNo: true, bankName: true, isActive: true },
    });
    return Response.json(methods);
  } catch (err) {
    console.error("GET /api/p2p/merchant/payment-methods:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — add a payout method. Body: { method, accountName, accountNo, bankName? }
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    const merchant = await merchantFor(dbUser.id);
    if (!merchant?.isVerified) return Response.json({ error: "Merchant account required" }, { status: 403 });

    let body: { method?: string; accountName?: string; accountNo?: string; bankName?: string };
    try { body = await req.json(); } catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }

    const method      = String(body.method ?? "").toUpperCase();
    const accountName = String(body.accountName ?? "").trim();
    const accountNo   = String(body.accountNo ?? "").trim();
    const bankName    = body.bankName ? String(body.bankName).trim() : null;

    if (!ALL_PAYMENT_CODES.has(method)) return Response.json({ error: "Unsupported payment method" }, { status: 400 });
    if (accountName.length < 2)         return Response.json({ error: "Enter the account holder name" }, { status: 400 });
    if (accountNo.length < 4)           return Response.json({ error: "Enter a valid account/phone number" }, { status: 400 });

    const isBank = BANK_CODES.has(method);
    if (isBank && !bankName) return Response.json({ error: "Enter the bank name" }, { status: 400 });

    // One entry per rail — replace if it already exists.
    await db.p2PPaymentMethod.deleteMany({ where: { merchantId: merchant.id, name: method } });

    const created = await db.p2PPaymentMethod.create({
      data: {
        merchantId:  merchant.id,
        type:        isBank ? PaymentType.BANK : PaymentType.MPESA,
        name:        method, // rail code — matched against the order's paymentMethod
        accountName,
        accountNo,
        bankName:    isBank ? bankName : null,
        isActive:    true,
      },
      select: { id: true, type: true, name: true, accountName: true, accountNo: true, bankName: true, isActive: true },
    });
    return Response.json(created, { status: 201 });
  } catch (err) {
    console.error("POST /api/p2p/merchant/payment-methods:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
