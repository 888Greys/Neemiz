import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// POST /api/admin/p2p/deposits/[id] — approve or reject a crypto deposit
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    if (!dbUser.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

    let body: { action: string; note?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { action, note } = body;

    if (!["approve", "reject"].includes(action)) {
      return Response.json({ error: "Invalid action. Use 'approve' or 'reject'." }, { status: 400 });
    }

    const deposit = await db.p2PCryptoDeposit.findUnique({
      where: { id },
      include: { merchant: { select: { id: true, userId: true, displayName: true } } },
    });
    if (!deposit) return Response.json({ error: "Deposit not found" }, { status: 404 });
    if (deposit.status !== "PENDING") return Response.json({ error: "Deposit is not pending" }, { status: 400 });

    const { merchant } = deposit;
    const amountNum    = Number(deposit.amount);
    const cryptoLabel  = `${amountNum.toFixed(6)} ${deposit.crypto}`;

    if (action === "approve") {
      await db.$transaction(async (tx) => {
        await tx.p2PCryptoBalance.upsert({
          where: { merchantId_crypto: { merchantId: merchant.id, crypto: deposit.crypto } },
          create: {
            merchantId: merchant.id,
            crypto:     deposit.crypto,
            total:      amountNum,
            locked:     0,
            available:  amountNum,
          },
          update: {
            total:     { increment: amountNum },
            available: { increment: amountNum },
          },
        });

        await tx.p2PCryptoDeposit.update({
          where: { id },
          data: { status: "APPROVED", adminNote: note ?? null },
        });

        await tx.notification.create({
          data: {
            userId: merchant.userId,
            type:   "p2p_released",
            title:  "Crypto deposit approved",
            body:   `Your deposit of ${cryptoLabel} (${deposit.network}) has been approved and credited to your merchant balance.`,
            link:   "/p2p/merchant",
          },
        });
      });
    } else {
      await db.$transaction(async (tx) => {
        await tx.p2PCryptoDeposit.update({
          where: { id },
          data: { status: "REJECTED", adminNote: note ?? null },
        });

        await tx.notification.create({
          data: {
            userId: merchant.userId,
            type:   "p2p_cancelled",
            title:  "Crypto deposit rejected",
            body:   note
              ? `Your deposit of ${cryptoLabel} was rejected: ${note}`
              : `Your deposit of ${cryptoLabel} was rejected. Please contact support.`,
            link:   "/p2p/merchant",
          },
        });
      });
    }

    return Response.json({ ok: true, action });
  } catch (err) {
    console.error("POST /api/admin/p2p/deposits/[id]:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
