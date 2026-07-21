import { createHmac, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { bokDb } from "@/lib/db-bok";
import { mbkDb } from "@/lib/db-mbk";
import { binarymarketDb } from "@/lib/db-binarymarket";
import { grantFirstDepositBonus } from "@/lib/first-deposit-bonus";
import { normalizeKenyanPhone } from "@/lib/lipaharaka";

function safeEqual(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function matchesSignature(raw: string, headers: Headers, secret: string) {
  const hexLower = createHmac("sha256", secret).update(raw).digest("hex");
  const b64 = createHmac("sha256", secret).update(raw).digest("base64");
  return [...headers.entries()].some(([, value]) => {
    const v = value.replace(/^sha256=/i, "").trim();
    return safeEqual(v.toLowerCase(), hexLower) || safeEqual(v, b64);
  });
}

const TRUSTED_CALLBACK_IPS = (process.env.LIPAHARAKA_CALLBACK_IPS ?? "102.130.123.40")
  .split(",").map((s) => s.trim()).filter(Boolean);

function isTrustedLipaOrigin(headers: Headers) {
  const ip = headers.get("cf-connecting-ip")?.trim();
  return !!ip && TRUSTED_CALLBACK_IPS.includes(ip);
}

function parseCallbackBody(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    const form = new URLSearchParams(raw);
    const entries = [...form.entries()];
    return entries.length ? Object.fromEntries(entries) : null;
  }
}

async function recordWebhookStatus(method: "signature" | "ip" | "rejected") {
  try {
    const value = JSON.stringify({ at: new Date().toISOString(), method });
    await db.systemSetting.upsert({ where: { key: "lipa_webhook_status" }, update: { value }, create: { key: "lipa_webhook_status", value } });
  } catch { /* ignore */ }
}

async function findLipaTx(
  client: PrismaClient,
  reference: string,
  phone: string,
  amount: number,
  body: Record<string, unknown>,
) {
  let tx = reference
    ? await client.transaction.findFirst({ where: { reference, provider: "lipaharaka", status: { in: ["PENDING", "FAILED"] } }, orderBy: { createdAt: "desc" } })
    : null;
  if (!tx && reference) {
    tx = await client.transaction.findFirst({
      where: {
        provider: "lipaharaka",
        status: { in: ["PENDING", "FAILED"] },
        OR: [
          { metadata: { path: ["lipaTransactionId"], equals: reference } },
          { metadata: { path: ["lipaTransactionId"], equals: String(body.payment_id ?? body.transaction_id ?? "") } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
  }
  if (!tx && phone && Number.isFinite(amount)) {
    const candidates = await client.transaction.findMany({
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
  return tx;
}

async function applyLipaCallback(
  client: PrismaClient,
  found: NonNullable<Awaited<ReturnType<typeof findLipaTx>>>,
  opts: {
    paid: boolean;
    failed: boolean;
    reference: string;
    amount: number;
    phone: string;
    body: Record<string, unknown>;
    providerMessage: string;
    statusStr: string;
  },
): Promise<"ok" | "rejected"> {
  const meta = found.metadata as { msisdn?: string; payout?: number; receipt?: string } | null;
  const expectedAmount = found.type === "WITHDRAWAL" ? Number(meta?.payout) : Number(found.amount);
  const storedPhone = normalizeKenyanPhone(String(meta?.msisdn ?? ""));
  if (expectedAmount !== opts.amount || storedPhone !== opts.phone) return "rejected";

  const wasFailed = found.status === "FAILED";
  await client.$transaction(async (prisma) => {
    if (opts.paid) {
      const claimed = await prisma.transaction.updateMany({
        where: { id: found.id, status: { in: ["PENDING", "FAILED"] } },
        data: {
          status: "COMPLETED",
          ...(found.type === "DEPOSIT" && opts.reference ? { reference: opts.reference } : {}),
          metadata: {
            ...(meta ?? {}),
            receipt: opts.body.receipt ?? meta?.receipt ?? "",
            ...(found.type === "WITHDRAWAL" && opts.reference ? { lipaB2cTxnId: opts.reference } : {}),
            lipaCallback: true,
            resultDesc: opts.providerMessage || undefined,
          },
        },
      });
      if (claimed.count) {
        if (found.type === "DEPOSIT") {
          await prisma.user.update({ where: { id: found.userId }, data: { walletBalance: { increment: found.amount } } });
          await grantFirstDepositBonus(prisma, found.userId, Number(found.amount), found.id);
        } else if (found.type === "WITHDRAWAL" && wasFailed) {
          await prisma.user.update({ where: { id: found.userId }, data: { walletBalance: { decrement: found.amount } } });
        }
      }
    } else if (opts.failed) {
      const claimed = await prisma.transaction.updateMany({
        where: { id: found.id, status: "PENDING" },
        data: { status: "FAILED", metadata: { ...(meta ?? {}), lipaCallback: true, failureReason: opts.providerMessage || opts.statusStr || "failed" } },
      });
      if (claimed.count && found.type === "WITHDRAWAL") {
        await prisma.user.update({ where: { id: found.userId }, data: { walletBalance: { increment: found.amount } } });
      }
    }
  });
  return "ok";
}

export async function POST(req: Request) {
  const secret = process.env.LIPAHARAKA_CALLBACK_SECRET;
  const raw = await req.text();
  const sigOk = !!secret && matchesSignature(raw, req.headers, secret);
  const ipOk = isTrustedLipaOrigin(req.headers);
  const verified = sigOk || ipOk;
  await recordWebhookStatus(sigOk ? "signature" : ipOk ? "ip" : "rejected");
  if (!verified) {
    console.warn(`[lipa-webhook] 401 rejected callback from ip=${req.headers.get("cf-connecting-ip") ?? "?"} — set LIPAHARAKA_CALLBACK_SECRET to the dashboard webhook secret (or check LIPAHARAKA_CALLBACK_IPS)`);
    if (process.env.LIPAHARAKA_WEBHOOK_DEBUG === "true") {
      const hdrs = Object.fromEntries([...req.headers.entries()]);
      const hmacHex = secret ? createHmac("sha256", secret).update(raw).digest("hex") : "(no secret)";
      const hmacB64 = secret ? createHmac("sha256", secret).update(raw).digest("base64") : "(no secret)";
      console.log("[lipa-webhook-debug] 401 callback", JSON.stringify({ headers: hdrs, bodyPreview: raw.slice(0, 400), ourHmacHex: hmacHex, ourHmacB64: hmacB64 }));
    }
    return new Response("Unauthorized", { status: 401 });
  }
  const body = parseCallbackBody(raw);
  if (!body) return new Response("Bad request", { status: 400 });

  const reference = String(
    body.checkout_request_id ?? body.CheckoutRequestID
    ?? body.withdrawal_id ?? body.withdrawalId
    ?? body.transaction_id ?? body.payment_id ?? "",
  );
  const rawAmount = body.amount ?? (body.CallbackMetadata as { Item?: Array<{ Name: string; Value: unknown }> } | undefined)?.Item?.find((i) => i.Name === "Amount")?.Value;
  const amount = Number(String(rawAmount ?? "").replace(/,/g, ""));
  const phone = normalizeKenyanPhone(String(body.phone ?? (body.CallbackMetadata as { Item?: Array<{ Name: string; Value: unknown }> } | undefined)?.Item?.find((i) => i.Name === "PhoneNumber")?.Value ?? ""));

  const statusStr = String(body.status ?? "").toLowerCase();
  const providerMessage = String(body.result_desc ?? body.message ?? body.error ?? body.description ?? "");
  const paid = ["paid", "completed", "success", "successful"].includes(statusStr) || Number(body.ResultCode) === 0;
  const failed = !paid && (
    ["fail", "error", "reject", "cancel", "declin"].some((s) => statusStr.includes(s))
    || (body.ResultCode != null && Number(body.ResultCode) !== 0)
  );
  if (!paid && !failed) return new Response("OK");

  const clients: Array<{ name: string; client: PrismaClient }> = [{ name: "neemiz", client: db }];
  const bok = bokDb();
  if (bok) clients.push({ name: "binaryoptionske", client: bok });
  const mbk = mbkDb();
  if (mbk) clients.push({ name: "moneybinaryke", client: mbk });
  const bm = binarymarketDb();
  if (bm) clients.push({ name: "binarymarket", client: bm });

  for (const { name, client } of clients) {
    const tx = await findLipaTx(client, reference, phone, amount, body);
    if (!tx) continue;
    const result = await applyLipaCallback(client, tx, {
      paid, failed, reference, amount, phone, body, providerMessage, statusStr,
    });
    if (result === "rejected") return new Response("Rejected", { status: 422 });
    console.info(`[lipa-webhook] credited via ${name} tx=${tx.id} type=${tx.type} status=${paid ? "paid" : "failed"}`);
    return new Response("OK");
  }

  console.warn(`[lipa-webhook] no matching tx for status=${statusStr} ref=${reference || "-"} phone=${phone || "-"} amount=${amount}`);
  return new Response("OK");
}
