import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { initiateLipaHarakaStk, normalizeKenyanPhone } from "@/lib/lipaharaka";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { phone?: string; amount?: number } | null;
  const amount = Number(body?.amount);
  const phone = normalizeKenyanPhone(String(body?.phone ?? ""));
  if (!Number.isInteger(amount) || amount < 1 || amount > 150_000) return Response.json({ error: "Amount must be a whole number between KSh 1 and KSh 150,000" }, { status: 400 });
  if (!/^254[17]\d{8}$/.test(phone)) return Response.json({ error: "Invalid Safaricom number" }, { status: 400 });
  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const transaction = await db.transaction.create({ data: { userId: dbUser.id, type: "DEPOSIT", amount, currency: "KES", status: "PENDING", provider: "lipaharaka", metadata: { msisdn: phone } } });
  try {
    const provider = await initiateLipaHarakaStk(phone, amount);
    await db.transaction.update({ where: { id: transaction.id }, data: { reference: provider.checkoutRequestId, metadata: { msisdn: phone, lipaTransactionId: provider.transactionId } } });
    return Response.json({ transactionId: transaction.id, status: "queued" });
  } catch (error) {
    await db.transaction.update({ where: { id: transaction.id }, data: { status: "FAILED" } });
    return Response.json({ error: error instanceof Error ? error.message : "Payment provider error" }, { status: 502 });
  }
}
