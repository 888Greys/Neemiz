import { db } from "@/lib/db";

// MegaPay posts here after the STK push completes/fails.
// The polling route (/api/wallet/transaction/[id]) also settles transactions,
// so this callback is a belt-and-suspenders guarantee.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // MegaPay callback fields
  const requestId = (body.transaction_request_id ?? body.TransactionRequestID) as string | undefined;
  const mpStatus = String(body.TransactionStatus ?? body.status ?? "").toLowerCase();
  const amount = Number(body.Amount ?? body.amount ?? 0);

  if (!requestId) return new Response("Missing transaction_request_id", { status: 400 });

  const tx = await db.transaction.findFirst({
    where: { reference: requestId },
    include: { user: { select: { id: true } } },
  });

  if (!tx) return new Response("Transaction not found", { status: 404 });
  if (tx.status !== "PENDING") return new Response("OK", { status: 200 }); // idempotent

  const completed = mpStatus === "completed" || mpStatus === "success" || mpStatus === "paid";

  if (completed) {
    const creditAmount = amount > 0 ? amount : Number(tx.amount);
    await db.$transaction([
      db.transaction.update({
        where: { id: tx.id },
        data: { status: "COMPLETED", amount: creditAmount, metadata: { callback: JSON.parse(JSON.stringify(body)) } },
      }),
      db.user.update({
        where: { id: tx.userId },
        data: { walletBalance: { increment: creditAmount } },
      }),
    ]);
  } else {
    await db.transaction.update({
      where: { id: tx.id },
      data: { status: "FAILED", metadata: { callback: JSON.parse(JSON.stringify(body)) } },
    });
  }

  return new Response("OK", { status: 200 });
}
