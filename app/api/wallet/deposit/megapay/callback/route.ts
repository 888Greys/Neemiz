import { db } from "@/lib/db";
import { TransactionStatus } from "@prisma/client";

// MegaPay posts here after the STK push completes/fails.
// The polling route (/api/wallet/transaction/[id]) also settles transactions,
// so this callback is a belt-and-suspenders guarantee.
export async function POST(req: Request) {
  const callbackToken = process.env.MEGAPAY_CALLBACK_TOKEN ?? "";
  if (!callbackToken) {
    console.error("MegaPay callback rejected: MEGAPAY_CALLBACK_TOKEN is not configured");
    return new Response("Callback not configured", { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const suppliedToken =
    String(body.callback_token ?? "") ||
    req.headers.get("x-callback-token") ||
    req.headers.get("x-megapay-token") ||
    "";
  if (suppliedToken !== callbackToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  // MegaPay callback fields
  const requestId = (body.transaction_request_id ?? body.TransactionRequestID) as string | undefined;
  const mpStatus = String(body.TransactionStatus ?? body.status ?? "").toLowerCase();

  if (!requestId) return new Response("Missing transaction_request_id", { status: 400 });

  const tx = await db.transaction.findFirst({
    where: { reference: requestId },
    include: { user: { select: { id: true } } },
  });

  if (!tx) return new Response("Transaction not found", { status: 404 });
  if (tx.status !== "PENDING") return new Response("OK", { status: 200 }); // idempotent

  const completed = mpStatus === "completed" || mpStatus === "success" || mpStatus === "paid";

  if (completed) {
    const creditAmount = Number(tx.amount);
    await db.$transaction(async (prismaTx) => {
      const claimed = await prismaTx.transaction.updateMany({
        where: { id: tx.id, status: TransactionStatus.PENDING },
        data: { status: TransactionStatus.COMPLETED, metadata: { callback: JSON.parse(JSON.stringify(body)) } },
      });
      if (claimed.count === 0) return;

      await prismaTx.user.update({
        where: { id: tx.userId },
        data: { walletBalance: { increment: creditAmount } },
      });
    });
  } else {
    await db.transaction.updateMany({
      where: { id: tx.id, status: TransactionStatus.PENDING },
      data: { status: TransactionStatus.FAILED, metadata: { callback: JSON.parse(JSON.stringify(body)) } },
    });
  }

  return new Response("OK", { status: 200 });
}
