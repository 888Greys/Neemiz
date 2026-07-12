import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { initiateLipaHarakaStk, normalizeKenyanPhone } from "@/lib/lipaharaka";

// Anti-spam knobs (env-overridable so they can be tuned without a deploy).
// One account was firing 20 STK pushes over a few hours (bursts of 4 in the
// same minute), all failing — it spams the customer's phone and pollutes the
// provider dashboard. These guards throttle repeated prompts per user AND per
// phone number (the phone is the thing that actually gets the STK prompt).
const BURST_SECONDS   = Number(process.env.DEPOSIT_BURST_SECONDS   ?? 20);   // min gap between prompts
const PENDING_SECONDS = Number(process.env.DEPOSIT_PENDING_SECONDS ?? 90);   // a live prompt is still on the phone
const FAIL_WINDOW_MIN = Number(process.env.DEPOSIT_FAIL_WINDOW_MIN ?? 15);   // lookback for failure cooldown
const FAIL_MAX        = Number(process.env.DEPOSIT_FAIL_MAX        ?? 4);    // failures before cooldown

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { phone?: string; amount?: number } | null;
  const amount = Number(body?.amount);
  const phone = normalizeKenyanPhone(String(body?.phone ?? ""));
  if (!Number.isInteger(amount) || amount < 100 || amount > 150_000) return Response.json({ error: "Amount must be a whole number between KSh 100 and KSh 150,000" }, { status: 400 });
  if (!/^254[17]\d{8}$/.test(phone)) return Response.json({ error: "Invalid Safaricom number" }, { status: 400 });
  // Reject obviously fake/placeholder numbers (e.g. 254700000000) — they can
  // only ever fail and are a hallmark of endpoint probing.
  if (/^254[17]0{8}$/.test(phone) || /^254[17](\d)\1{7}$/.test(phone)) {
    return Response.json({ error: "Enter the phone number that will receive the M-Pesa prompt." }, { status: 400 });
  }
  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  // ── Anti-spam throttle: look at this user's / this phone's recent deposits ──
  const now = Date.now();
  const windowStart = new Date(now - FAIL_WINDOW_MIN * 60_000);
  const recent = await db.transaction.findMany({
    where: {
      provider: "lipaharaka",
      type: "DEPOSIT",
      createdAt: { gte: windowStart },
      OR: [
        { userId: dbUser.id },
        { metadata: { path: ["msisdn"], equals: phone } },
      ],
    },
    select: { status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // 1. A prompt is still live on the phone — don't stack another one.
  const livePending = recent.find(
    (t) => t.status === "PENDING" && t.createdAt.getTime() > now - PENDING_SECONDS * 1000,
  );
  if (livePending) {
    return Response.json(
      { error: "A payment request is already on your phone. Enter your M-Pesa PIN to complete it, or wait a moment.", code: "DEPOSIT_PENDING" },
      { status: 429 },
    );
  }

  // 2. Burst guard — a couple of taps in the same few seconds.
  const veryRecent = recent.find((t) => t.createdAt.getTime() > now - BURST_SECONDS * 1000);
  if (veryRecent) {
    return Response.json(
      { error: "Please wait a few seconds before requesting another prompt.", code: "DEPOSIT_TOO_FAST" },
      { status: 429 },
    );
  }

  // 3. Repeated failures — cool down so we stop bombarding the phone.
  const failedCount = recent.filter((t) => t.status === "FAILED").length;
  if (failedCount >= FAIL_MAX) {
    return Response.json(
      {
        error: `Several payment prompts have failed. Please wait ${FAIL_WINDOW_MIN} minutes, make sure your M-Pesa has enough balance, then try again.`,
        code: "DEPOSIT_COOLDOWN",
      },
      { status: 429 },
    );
  }

  const transaction = await db.transaction.create({ data: { userId: dbUser.id, type: "DEPOSIT", amount, currency: "KES", status: "PENDING", provider: "lipaharaka", metadata: { msisdn: phone } } });
  try {
    const provider = await initiateLipaHarakaStk(phone, amount);
    await db.transaction.update({ where: { id: transaction.id }, data: { reference: provider.checkoutRequestId, metadata: { msisdn: phone, lipaTransactionId: provider.transactionId } } });
    return Response.json({ transactionId: transaction.id, status: "queued" });
  } catch (error) {
    await db.transaction.update({ where: { id: transaction.id }, data: { status: "FAILED" } });
    return Response.json({ error: error instanceof Error ? error.message : "Payment provider error" }, { status: 502 });
  }
}
