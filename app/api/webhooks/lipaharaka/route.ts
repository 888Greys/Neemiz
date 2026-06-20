import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

function matchesSignature(raw: string, headers: Headers, secret: string) {
  const candidates = [createHmac("sha256", secret).update(raw).digest("hex"), createHmac("sha256", secret).update(raw).digest("base64")];
  return [...headers.entries()].some(([, value]) => candidates.some((candidate) => value.length === candidate.length && timingSafeEqual(Buffer.from(value), Buffer.from(candidate))));
}

export async function POST(req: Request) {
  const secret = process.env.LIPAHARAKA_CALLBACK_SECRET;
  const raw = await req.text();
  if (!secret || !matchesSignature(raw, req.headers, secret)) {
    // TEMP DIAGNOSTIC (2026-06-20): Lipa callbacks are 401ing — capture how Lipa
    // actually signs so we can match it. Remove once the scheme is confirmed.
    if (process.env.LIPAHARAKA_WEBHOOK_DEBUG === "true") {
      const hdrs = Object.fromEntries([...req.headers.entries()]);
      const hmacHex = secret ? createHmac("sha256", secret).update(raw).digest("hex") : "(no secret)";
      const hmacB64 = secret ? createHmac("sha256", secret).update(raw).digest("base64") : "(no secret)";
      console.log("[lipa-webhook-debug] 401 callback", JSON.stringify({ headers: hdrs, bodyPreview: raw.slice(0, 400), ourHmacHex: hmacHex, ourHmacB64: hmacB64 }));
    }
    return new Response("Unauthorized", { status: 401 });
  }
  const body = JSON.parse(raw) as Record<string, unknown>;
  const reference = String(body.checkout_request_id ?? body.CheckoutRequestID ?? body.withdrawal_id ?? body.withdrawalId ?? body.transaction_id ?? "");
  const amount = Number(body.amount ?? (body.CallbackMetadata as { Item?: Array<{ Name: string; Value: unknown }> } | undefined)?.Item?.find((i) => i.Name === "Amount")?.Value);
  const phone = String(body.phone ?? (body.CallbackMetadata as { Item?: Array<{ Name: string; Value: unknown }> } | undefined)?.Item?.find((i) => i.Name === "PhoneNumber")?.Value ?? "");

  const statusStr = String(body.status ?? "").toLowerCase();
  const paid = ["paid", "completed", "success", "successful"].includes(statusStr) || Number(body.ResultCode) === 0;
  const failed = !paid && (
    ["fail", "error", "reject", "cancel", "declin"].some((s) => statusStr.includes(s))
    || (body.ResultCode != null && Number(body.ResultCode) !== 0)
  );
  // Intermediate states (e.g. "processing", "pending") — ack and wait for the final callback.
  if (!paid && !failed) return new Response("OK");

  // Match by provider reference first; fall back to msisdn + amount, since async
  // withdrawals are often accepted before a reference is assigned. Works for both
  // DEPOSIT (amount === tx.amount) and WITHDRAWAL (amount === metadata.payout).
  let tx = reference
    ? await db.transaction.findFirst({ where: { reference, provider: "lipaharaka", status: { in: ["PENDING", "FAILED"] } }, orderBy: { createdAt: "desc" } })
    : null;
  if (!tx && phone && Number.isFinite(amount)) {
    const candidates = await db.transaction.findMany({
      where: { provider: "lipaharaka", status: { in: ["PENDING", "FAILED"] }, metadata: { path: ["msisdn"], equals: phone } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    tx = candidates.find((c) => {
      const m = c.metadata as { payout?: number } | null;
      const expected = c.type === "WITHDRAWAL" ? Number(m?.payout) : Number(c.amount);
      return expected === amount;
    }) ?? null;
  }
  if (!tx) return new Response("OK");

  const found = tx;
  const meta = found.metadata as { msisdn?: string; payout?: number } | null;
  const expectedAmount = found.type === "WITHDRAWAL" ? Number(meta?.payout) : Number(found.amount);
  if (expectedAmount !== amount || meta?.msisdn !== phone) return new Response("Rejected", { status: 422 });

  const wasFailed = found.status === "FAILED";
  await db.$transaction(async (prisma) => {
    if (paid) {
      const claimed = await prisma.transaction.updateMany({
        where: { id: found.id, status: { in: ["PENDING", "FAILED"] } },
        data:  { status: "COMPLETED", reference: reference || undefined, metadata: { ...(meta ?? {}), receipt: body.receipt ?? "", lipaCallback: true } },
      });
      if (claimed.count) {
        if (found.type === "DEPOSIT") {
          await prisma.user.update({ where: { id: found.userId }, data: { walletBalance: { increment: found.amount } } });
        } else if (found.type === "WITHDRAWAL" && wasFailed) {
          // Previously marked FAILED and refunded, but Lipa actually disbursed —
          // re-debit to undo the erroneous refund.
          await prisma.user.update({ where: { id: found.userId }, data: { walletBalance: { decrement: found.amount } } });
        }
        // WITHDRAWAL that was PENDING: balance already debited at request time.
      }
    } else {
      // failed
      const claimed = await prisma.transaction.updateMany({
        where: { id: found.id, status: "PENDING" },
        data:  { status: "FAILED", metadata: { ...(meta ?? {}), lipaCallback: true, failureReason: statusStr || "failed" } },
      });
      if (claimed.count && found.type === "WITHDRAWAL") {
        // Lipa could not disburse — refund the held balance.
        await prisma.user.update({ where: { id: found.userId }, data: { walletBalance: { increment: found.amount } } });
      }
    }
  });
  return new Response("OK");
}
