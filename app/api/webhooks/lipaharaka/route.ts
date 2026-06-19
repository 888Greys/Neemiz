import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

function matchesSignature(raw: string, headers: Headers, secret: string) {
  const candidates = [createHmac("sha256", secret).update(raw).digest("hex"), createHmac("sha256", secret).update(raw).digest("base64")];
  return [...headers.entries()].some(([, value]) => candidates.some((candidate) => value.length === candidate.length && timingSafeEqual(Buffer.from(value), Buffer.from(candidate))));
}

export async function POST(req: Request) {
  const secret = process.env.LIPAHARAKA_CALLBACK_SECRET;
  const raw = await req.text();
  if (!secret || !matchesSignature(raw, req.headers, secret)) return new Response("Unauthorized", { status: 401 });
  const body = JSON.parse(raw) as Record<string, unknown>;
  const reference = String(body.checkout_request_id ?? body.CheckoutRequestID ?? "");
  const amount = Number(body.amount ?? (body.CallbackMetadata as { Item?: Array<{ Name: string; Value: unknown }> } | undefined)?.Item?.find((i) => i.Name === "Amount")?.Value);
  const phone = String(body.phone ?? (body.CallbackMetadata as { Item?: Array<{ Name: string; Value: unknown }> } | undefined)?.Item?.find((i) => i.Name === "PhoneNumber")?.Value ?? "");
  const paid = String(body.status ?? "").toLowerCase() === "paid" || Number(body.ResultCode) === 0;
  const tx = await db.transaction.findFirst({ where: { reference, provider: "lipaharaka", type: "DEPOSIT", status: "PENDING" } });
  if (!tx) return new Response("OK");
  const meta = tx.metadata as { msisdn?: string } | null;
  if (!paid || Number(tx.amount) !== amount || meta?.msisdn !== phone) return new Response("Rejected", { status: 422 });
  await db.$transaction(async (prisma) => {
    const claimed = await prisma.transaction.updateMany({ where: { id: tx.id, status: "PENDING" }, data: { status: "COMPLETED", metadata: { ...(meta ?? {}), receipt: body.receipt ?? "", lipaCallback: true } } });
    if (claimed.count) await prisma.user.update({ where: { id: tx.userId }, data: { walletBalance: { increment: tx.amount } } });
  });
  return new Response("OK");
}
