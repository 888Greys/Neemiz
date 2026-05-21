import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { TransactionStatus } from "@prisma/client";

const MEGAPAY_BASE_URL = (process.env.MEGAPAY_BASE_URL ?? "").replace(/\/+$/, "");
const MEGAPAY_API_KEY  = process.env.MEGAPAY_API_KEY ?? "";
const MEGAPAY_EMAIL    = process.env.MEGAPAY_EMAIL ?? "";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await db.user.findUnique({ where: { supabaseId: user.id }, select: { id: true } });
    if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

    const tx = await db.transaction.findFirst({
      where: { id: params.id, userId: dbUser.id },
    });
    if (!tx) return Response.json({ error: "Not found" }, { status: 404 });

    // Already settled — return immediately
    if (tx.status !== "PENDING") {
      return Response.json({ id: tx.id, status: tx.status, amount: Number(tx.amount) });
    }

    // Poll MegaPay for live status if we have a provider reference
    if (tx.reference && MEGAPAY_BASE_URL && MEGAPAY_API_KEY && MEGAPAY_EMAIL) {
      const mpRes = await fetch(`${MEGAPAY_BASE_URL}/backend/v1/transactionstatus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key:                MEGAPAY_API_KEY,
          email:                  MEGAPAY_EMAIL,
          transaction_request_id: tx.reference,
        }),
      });

      const data = await mpRes.json().catch(() => ({})) as Record<string, unknown>;
      const mpStatus  = String(data.TransactionStatus ?? data.status ?? "").toLowerCase();
      const completed = mpStatus === "completed" || mpStatus === "success" || mpStatus === "paid";
      const failed    = mpStatus === "failed" || mpStatus === "cancelled" || mpStatus === "expired";

      if (completed) {
        const creditAmount = Number(tx.amount);
        await db.$transaction(async (prismaTx) => {
          const claimed = await prismaTx.transaction.updateMany({
            where: { id: tx.id, status: TransactionStatus.PENDING },
            data:  { status: TransactionStatus.COMPLETED, metadata: { mpData: JSON.parse(JSON.stringify(data)) } },
          });
          if (claimed.count === 0) return;

          await prismaTx.user.update({
            where: { id: tx.userId },
            data:  { walletBalance: { increment: creditAmount } },
          });
        });
        return Response.json({ id: tx.id, status: "COMPLETED", amount: creditAmount });
      }

      if (failed) {
        await db.transaction.updateMany({
          where: { id: tx.id, status: TransactionStatus.PENDING },
          data:  { status: "FAILED", metadata: { mpData: JSON.parse(JSON.stringify(data)) } },
        });
        return Response.json({ id: tx.id, status: "FAILED", amount: Number(tx.amount) });
      }
    }

    return Response.json({ id: tx.id, status: "PENDING", amount: Number(tx.amount) });
  } catch (err) {
    console.error("Transaction status error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
