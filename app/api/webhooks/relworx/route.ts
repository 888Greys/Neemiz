import { db } from "@/lib/db";
import { TransactionStatus } from "@prisma/client";

// Relworx sends a webhook when the transfer settles.
// Verify using a shared secret in the URL: /api/webhooks/relworx?secret=XXX
// Set RELWORX_WEBHOOK_SECRET in your Vercel env vars and register
// https://www.nezeem.com/api/webhooks/relworx?secret=<value> in your Relworx dashboard.

export async function POST(req: Request) {
  const url    = new URL(req.url);
  const secret = url.searchParams.get("secret");

  const expected = process.env.RELWORX_WEBHOOK_SECRET;
  if (!expected || secret !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  // Relworx sends: { reference, status, ... }
  // status values: "successful" | "failed" | "pending"
  const reference = body.reference as string | undefined;
  const status    = (body.status as string | undefined)?.toLowerCase();

  if (!reference) {
    return Response.json({ error: "Missing reference" }, { status: 400 });
  }

  const txn = await db.transaction.findFirst({
    where: { OR: [{ id: reference }, { reference }] },
    select: { id: true, userId: true, amount: true, status: true },
  });

  if (!txn) {
    // Not found — acknowledge so Relworx doesn't keep retrying
    return Response.json({ ok: true, note: "unknown reference" });
  }

  // Idempotency: only act if still PENDING
  if (txn.status !== TransactionStatus.PENDING) {
    return Response.json({ ok: true, note: "already settled" });
  }

  if (status === "successful") {
    await db.transaction.update({
      where: { id: txn.id },
      data:  { status: TransactionStatus.COMPLETED },
    });
    return Response.json({ ok: true });
  }

  if (status === "failed") {
    // Refund the user's balance
    await db.$transaction([
      db.transaction.update({ where: { id: txn.id }, data: { status: TransactionStatus.FAILED } }),
      db.user.update({ where: { id: txn.userId }, data: { walletBalance: { increment: txn.amount } } }),
    ]);
    return Response.json({ ok: true });
  }

  // "pending" or unknown — no action yet
  return Response.json({ ok: true, note: "pending" });
}
