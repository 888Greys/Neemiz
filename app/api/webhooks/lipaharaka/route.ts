import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { grantFirstDepositBonus } from "@/lib/first-deposit-bonus";
import { normalizeKenyanPhone } from "@/lib/lipaharaka";

function safeEqual(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function matchesSignature(raw: string, headers: Headers, secret: string) {
  const hexLower = createHmac("sha256", secret).update(raw).digest("hex");
  const b64 = createHmac("sha256", secret).update(raw).digest("base64");
  // Lipa's x-signature is bare lowercase hex, but be tolerant of common provider
  // quirks so a trivial encoding mismatch can't 401 a genuine callback: strip an
  // optional "sha256=" algo prefix, compare hex case-insensitively, and also
  // accept base64 (case-sensitive).
  return [...headers.entries()].some(([, value]) => {
    const v = value.replace(/^sha256=/i, "").trim();
    return safeEqual(v.toLowerCase(), hexLower) || safeEqual(v, b64);
  });
}

// Signature scheme (per Lipa API v2 docs, 2026-07): X-Signature is
// HMAC-SHA256 of the RAW request body, keyed with the dashboard WEBHOOK SECRET
// (a value distinct from the api_key). matchesSignature() implements exactly
// this — so if verification fails, LIPAHARAKA_CALLBACK_SECRET does not equal the
// dashboard's webhook secret. As a fallback we also accept callbacks from Lipa's
// server IP: cf-connecting-ip is trustworthy because the origin (nginx:443) is
// firewalled to Cloudflare ranges only. Strict tx matching below is the last gate.
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
    // Lipa Haraka also posts standard URL-encoded callback bodies such as
    // `phone=254...&amount=...&status=paid`. The previous JSON-only parser
    // threw before a successful payment could be credited.
    const form = new URLSearchParams(raw);
    const entries = [...form.entries()];
    return entries.length ? Object.fromEntries(entries) : null;
  }
}

// Record how the most recent callback authenticated, so config can be verified
// from the admin UI (no VPS log access needed). Best-effort — never blocks.
async function recordWebhookStatus(method: "signature" | "ip" | "rejected") {
  try {
    const value = JSON.stringify({ at: new Date().toISOString(), method });
    await db.systemSetting.upsert({ where: { key: "lipa_webhook_status" }, update: { value }, create: { key: "lipa_webhook_status", value } });
  } catch { /* ignore */ }
}

export async function POST(req: Request) {
  const secret = process.env.LIPAHARAKA_CALLBACK_SECRET;
  const raw = await req.text();
  const sigOk = !!secret && matchesSignature(raw, req.headers, secret);
  const ipOk = isTrustedLipaOrigin(req.headers);
  const verified = sigOk || ipOk;
  await recordWebhookStatus(sigOk ? "signature" : ipOk ? "ip" : "rejected");
  if (!verified) {
    // Always surface rejected callbacks. Once Lipa updated their signing scheme
    // (v2, 2026-07), a stale secret makes EVERY callback fall through to the IP
    // check — and if that IP changes too, payers go uncredited silently.
    console.warn(`[lipa-webhook] 401 rejected callback from ip=${req.headers.get("cf-connecting-ip") ?? "?"} — set LIPAHARAKA_CALLBACK_SECRET to the dashboard webhook secret (or check LIPAHARAKA_CALLBACK_IPS)`);
    // TEMP DIAGNOSTIC (2026-06-20): kept until callbacks are confirmed flowing.
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

  // v2 STK callback: { status, amount, phone, receipt, result_desc, checkout_request_id }
  // v2 B2C callback: { phone, amount, transaction_id, status }  (no withdrawal_id)
  // Dashboard UI may still show "paid"; API docs use "completed" — accept both.
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
  // Intermediate states (e.g. "processing", "pending") — ack and wait for the final callback.
  if (!paid && !failed) return new Response("OK");

  // Match by provider reference first; then by Lipa payment_id stored in
  // metadata.lipaTransactionId (older STK responses stored that numeric id as
  // `reference`, which never equals the ws_CO_ CheckoutRequestID on callback);
  // finally fall back to msisdn + amount. Works for DEPOSIT and WITHDRAWAL.
  let tx = reference
    ? await db.transaction.findFirst({ where: { reference, provider: "lipaharaka", status: { in: ["PENDING", "FAILED"] } }, orderBy: { createdAt: "desc" } })
    : null;
  if (!tx && reference) {
    tx = await db.transaction.findFirst({
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
  if (!tx) {
    console.warn(`[lipa-webhook] no matching tx for status=${statusStr} ref=${reference || "-"} phone=${phone || "-"} amount=${amount}`);
    return new Response("OK");
  }

  const found = tx;
  const meta = found.metadata as { msisdn?: string; payout?: number } | null;
  const expectedAmount = found.type === "WITHDRAWAL" ? Number(meta?.payout) : Number(found.amount);
  const storedPhone = normalizeKenyanPhone(String(meta?.msisdn ?? ""));
  if (expectedAmount !== amount || storedPhone !== phone) return new Response("Rejected", { status: 422 });

  const wasFailed = found.status === "FAILED";
  await db.$transaction(async (prisma) => {
    if (paid) {
      const claimed = await prisma.transaction.updateMany({
        where: { id: found.id, status: { in: ["PENDING", "FAILED"] } },
        data:  {
          status: "COMPLETED",
          // STK: persist checkout_request_id. B2C: keep WD_ reference from submit —
          // v2 callback only sends transaction_id (a different id).
          ...(found.type === "DEPOSIT" && reference ? { reference } : {}),
          metadata: {
            ...(meta ?? {}),
            receipt: body.receipt ?? (meta as { receipt?: string } | null)?.receipt ?? "",
            ...(found.type === "WITHDRAWAL" && reference ? { lipaB2cTxnId: reference } : {}),
            lipaCallback: true,
            resultDesc: providerMessage || undefined,
          },
        },
      });
      if (claimed.count) {
        if (found.type === "DEPOSIT") {
          await prisma.user.update({ where: { id: found.userId }, data: { walletBalance: { increment: found.amount } } });
          // Match the user's FIRST real deposit with a play-only bonus.
          await grantFirstDepositBonus(prisma, found.userId, Number(found.amount), found.id);
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
        data:  { status: "FAILED", metadata: { ...(meta ?? {}), lipaCallback: true, failureReason: providerMessage || statusStr || "failed" } },
      });
      if (claimed.count && found.type === "WITHDRAWAL") {
        // Lipa could not disburse — refund the held balance.
        await prisma.user.update({ where: { id: found.userId }, data: { walletBalance: { increment: found.amount } } });
      }
    }
  });
  return new Response("OK");
}
