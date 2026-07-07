import { TransactionStatus, TransactionType } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email, phone: user.phone });
  return Response.json({
    mainBalance: Number(dbUser.walletBalance),
    forexBalance: Number(dbUser.forexWalletBalance ?? 0),
    currency: dbUser.currency,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { amount?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const amount = Math.round(Number(body.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "Enter a valid amount" }, { status: 400 });
  }

  const dbUser = await getOrCreateUser(user.id, { email: user.email, phone: user.phone });
  const reference = `forex-funding-${crypto.randomUUID()}`;

  try {
    const result = await db.$transaction(async (tx) => {
      const debited = await tx.user.updateMany({
        where: { id: dbUser.id, walletBalance: { gte: amount } },
        data: {
          walletBalance: { decrement: amount },
          forexWalletBalance: { increment: amount },
        },
      });
      if (debited.count === 0) throw new Error("INSUFFICIENT_BALANCE");

      await tx.transaction.create({
        data: {
          userId: dbUser.id,
          type: TransactionType.WITHDRAWAL,
          amount,
          currency: "KES",
          status: TransactionStatus.COMPLETED,
          provider: "forex",
          reference,
          metadata: { action: "main_to_forex_wallet" },
        },
      });

      const updated = await tx.user.findUniqueOrThrow({
        where: { id: dbUser.id },
        select: { walletBalance: true, forexWalletBalance: true },
      });

      return {
        mainBalance: Number(updated.walletBalance),
        forexBalance: Number(updated.forexWalletBalance),
      };
    });

    return Response.json({ ok: true, ...result, reference });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return Response.json({ error: "Insufficient main wallet balance" }, { status: 400 });
    }
    console.error("POST /api/forex/funding:", error);
    return Response.json({ error: "Funding failed" }, { status: 500 });
  }
}
