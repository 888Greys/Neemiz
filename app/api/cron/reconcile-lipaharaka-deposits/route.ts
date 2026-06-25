/**
 * Expires Lipa Haraka STK deposit prompts that never reach a terminal callback.
 *
 * Lipa does not provide a status-query endpoint. Successful payments arrive via
 * the callback webhook, but cancelled/expired prompts frequently do not. Without
 * this sweep those attempts remain PENDING in the wallet forever. A late paid
 * callback remains safe: the webhook atomically accepts FAILED deposits and
 * credits them exactly once.
 */
import { db } from "@/lib/db";
import { TransactionStatus, TransactionType } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // M-Pesa STK prompts expire fast and, in production, every PAID Lipa callback
  // has arrived within ~70s of initiation (measured over 7 days: 222/235 inside
  // 30s, max 67s). A deposit still PENDING after a few minutes is therefore an
  // abandoned/declined prompt, not a slow success — so expire it promptly to keep
  // the wallet/cockpit honest and let the user retry, rather than leaving it
  // "processing" for half an hour. Staying safe in the rare slow case: the webhook
  // atomically accepts FAILED deposits, so a late paid callback still credits once.
  const staleMinutes = Math.max(3, Number(process.env.LIPAHARAKA_DEPOSIT_STALE_MINUTES ?? "5"));
  const cutoff = new Date(Date.now() - staleMinutes * 60_000);

  const stale = await db.transaction.findMany({
    where: {
      provider: "lipaharaka",
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.PENDING,
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, metadata: true },
  });

  let expired = 0;
  for (const deposit of stale) {
    const claimed = await db.transaction.updateMany({
      // Atomic claim prevents a racing paid callback from being overwritten.
      where: { id: deposit.id, status: TransactionStatus.PENDING },
      data: {
        status: TransactionStatus.FAILED,
        metadata: {
          ...((deposit.metadata as Record<string, unknown>) ?? {}),
          lipaReconciled: true,
          failureReason: `payment_prompt_expired_${staleMinutes}m`,
          reconciledAt: new Date().toISOString(),
        },
      },
    });
    expired += claimed.count;
  }

  if (expired) {
    console.log(`[reconcile-lipaharaka-deposits] expired ${expired} stale PENDING deposit(s) older than ${staleMinutes}m`);
  }

  return Response.json({ ok: true, scanned: stale.length, expired, staleMinutes });
}
