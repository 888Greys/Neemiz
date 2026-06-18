import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { ALL_PAYMENT_CODES } from "@/lib/p2p/payment-methods";
import { PaymentType } from "@prisma/client";

const BANK_CODES = new Set(["BANK", "KUDA", "FNB", "CAPITEC"]);

async function merchantFor(userId: string) {
  return db.merchantProfile.findUnique({ where: { userId } });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    const merchant = await merchantFor(dbUser.id);
    if (!merchant?.isVerified) return Response.json({ error: "Merchant account required" }, { status: 403 });

    const existing = await db.p2PPaymentMethod.findFirst({ where: { id, merchantId: merchant.id } });
    if (!existing) return Response.json({ error: "Payment method not found" }, { status: 404 });

    let body: { method?: string; accountName?: string; accountNo?: string; bankName?: string; isActive?: boolean };
    try { body = await req.json(); } catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }

    const method = String(body.method ?? existing.name).toUpperCase();
    const accountName = String(body.accountName ?? existing.accountName).trim();
    const accountNo = String(body.accountNo ?? existing.accountNo).trim();
    const bankName = body.bankName != null ? String(body.bankName).trim() : existing.bankName;

    if (!ALL_PAYMENT_CODES.has(method)) return Response.json({ error: "Unsupported payment method" }, { status: 400 });
    if (accountName.length < 2) return Response.json({ error: "Enter the account holder name" }, { status: 400 });
    if (accountNo.length < 4) return Response.json({ error: "Enter a valid account/phone number" }, { status: 400 });

    const isBank = BANK_CODES.has(method);
    if (isBank && !bankName) return Response.json({ error: "Enter the bank name" }, { status: 400 });

    const duplicate = await db.p2PPaymentMethod.findFirst({
      where: { merchantId: merchant.id, name: method, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) return Response.json({ error: "You already have this payment method. Edit the existing one instead." }, { status: 409 });

    const updated = await db.p2PPaymentMethod.update({
      where: { id },
      data: {
        type: isBank ? PaymentType.BANK : PaymentType.MPESA,
        name: method,
        accountName,
        accountNo,
        bankName: isBank ? bankName : null,
        ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      },
      select: { id: true, type: true, name: true, accountName: true, accountNo: true, bankName: true, isActive: true },
    });
    return Response.json(updated);
  } catch (err) {
    console.error("PATCH /api/p2p/merchant/payment-methods/[id]:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    const merchant = await merchantFor(dbUser.id);
    if (!merchant?.isVerified) return Response.json({ error: "Merchant account required" }, { status: 403 });

    const deleted = await db.p2PPaymentMethod.deleteMany({ where: { id, merchantId: merchant.id } });
    if (deleted.count === 0) return Response.json({ error: "Payment method not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/p2p/merchant/payment-methods/[id]:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
