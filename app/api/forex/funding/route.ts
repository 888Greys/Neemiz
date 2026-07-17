import { TransactionStatus, TransactionType } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export const dynamic = "force-dynamic";

/**
 * Forex no longer has a separate wallet. GET reports the main balance; POST
 * folds any leftover forex_wallet_balance into wallet_balance (idempotent) so
 * stale clients recover funds, then tells the client to use the main wallet.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email, phone: user.phone });
  const main = Number(dbUser.walletBalance);
  return Response.json({
    mainBalance: main,
    forexBalance: main,
    currency: dbUser.currency,
    unified: true,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Amount is ignored — transfers into a Forex sub-wallet are retired.
  try {
    await req.json();
  } catch {
    /* empty body ok */
  }

  const dbUser = await getOrCreateUser(user.id, { email: user.email, phone: user.phone });
  const reference = `forex-fold-${crypto.randomUUID()}`;

  try {
    const result = await db.$transaction(async (tx) => {
      const current = await tx.user.findUniqueOrThrow({
        where: { id: dbUser.id },
        select: { walletBalance: true, forexWalletBalance: true },
      });
      const leftover = Number(current.forexWalletBalance ?? 0);
      if (leftover > 0) {
        await tx.user.update({
          where: { id: dbUser.id },
          data: {
            walletBalance: { increment: leftover },
            forexWalletBalance: 0,
          },
        });
        await tx.transaction.create({
          data: {
            userId: dbUser.id,
            type: TransactionType.DEPOSIT,
            amount: leftover,
            currency: "KES",
            status: TransactionStatus.COMPLETED,
            provider: "forex",
            reference,
            metadata: { action: "forex_wallet_folded_into_main" },
          },
        });
      }

      const updated = await tx.user.findUniqueOrThrow({
        where: { id: dbUser.id },
        select: { walletBalance: true, forexWalletBalance: true },
      });

      return {
        mainBalance: Number(updated.walletBalance),
        forexBalance: Number(updated.walletBalance),
        folded: leftover,
      };
    });

    return Response.json({
      ok: true,
      ...result,
      unified: true,
      message: "Forex uses your main wallet — no transfer needed.",
      reference,
    });
  } catch (error) {
    console.error("POST /api/forex/funding:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
