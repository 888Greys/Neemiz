import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser, SuspendedAccountError } from "@/lib/get-or-create-user";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { submitOrder } from "@/lib/pesapal";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let body: { amountKes: number };
    try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

    const { amountKes } = body;
    if (!Number.isFinite(amountKes) || amountKes < 10) {
      return Response.json({ error: "Minimum deposit is KSh 10" }, { status: 400 });
    }
    if (amountKes > 1_000_000) {
      return Response.json({ error: "Maximum Pesapal deposit is KSh 1,000,000" }, { status: 400 });
    }

    const dbUser = await getOrCreateUser(user.id, { email: user.email });

    // Create PENDING transaction as the order reference
    const txn = await db.transaction.create({
      data: {
        userId:   dbUser.id,
        type:     TransactionType.DEPOSIT,
        amount:   amountKes,
        currency: "KES",
        status:   TransactionStatus.PENDING,
        provider: "pesapal",
        metadata: { requestedAt: new Date().toISOString() },
      },
    });

    const result = await submitOrder({
      id:          txn.id,
      amount:      amountKes,
      description: `Nezeem deposit ${txn.id}`,
      email:       dbUser.email ?? user.email ?? undefined,
      phone:       dbUser.phone ?? undefined,
      firstName:   dbUser.firstName ?? undefined,
      lastName:    dbUser.lastName ?? undefined,
    });

    await db.transaction.update({
      where: { id: txn.id },
      data: { reference: result.orderTrackingId, metadata: { requestedAt: new Date().toISOString(), orderTrackingId: result.orderTrackingId } },
    });

    return Response.json({ redirectUrl: result.redirectUrl, transactionId: txn.id });
  } catch (err) {
    if (err instanceof SuspendedAccountError) {
      return Response.json({ error: "Your account has been suspended. Contact support." }, { status: 403 });
    }
    console.error("Pesapal checkout error:", err);
    return Response.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
