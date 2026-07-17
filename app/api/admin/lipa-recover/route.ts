import { requireOwnerAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { grantFirstDepositBonus } from "@/lib/first-deposit-bonus";
import { normalizeKenyanPhone } from "@/lib/lipaharaka";
import { TransactionStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lipa Haraka deposit recovery. Credits players who PAID on Lipa but were never
 * credited on Nezeem (the phone-format callback bug). Driven by Lipa's exported
 * "paid" rows — the operator's evidence of real payment.
 *
 * POST body: { rows: {phone, amount, ref?}[], apply?: boolean }
 *   apply=false → PREVIEW: match paid rows to uncredited deposits, credit nothing.
 *   apply=true  → CREDIT each matched deposit exactly once (atomic claim, so a
 *                 late webhook callback can't double-credit), with an audit stamp.
 *
 * Match key: normalized phone + exact amount, against FAILED/PENDING lipaharaka
 * deposits in the last 60 days. Greedy 1:1 so two paid 200s map to two rows.
 */
const LOOKBACK_DAYS = 60;
const MAX_ROWS = 2000;

type PaidRow = { phone?: string; amount?: number | string; ref?: string };

export async function POST(req: Request) {
  const adminId = await requireOwnerAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null) as { rows?: PaidRow[]; apply?: boolean } | null;
  const rawRows = Array.isArray(body?.rows) ? body!.rows! : [];
  if (!rawRows.length) return Response.json({ error: "No paid rows provided" }, { status: 400 });
  if (rawRows.length > MAX_ROWS) return Response.json({ error: `Too many rows (max ${MAX_ROWS})` }, { status: 400 });
  const apply = body?.apply === true;

  // Normalize + validate the pasted paid rows.
  const paid = rawRows.map((r) => ({
    phone: normalizeKenyanPhone(String(r.phone ?? "")),
    amount: Math.round(Number(String(r.amount ?? "").replace(/[^\d.]/g, ""))),
    ref: (r.ref ?? "").toString().trim() || null,
  })).filter((r) => /^254[17]\d{8}$/.test(r.phone) && Number.isFinite(r.amount) && r.amount > 0);

  // Pool of uncredited Lipa deposits to match against.
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
  const pool = await db.transaction.findMany({
    where: { provider: "lipaharaka", type: "DEPOSIT", status: { in: [TransactionStatus.FAILED, TransactionStatus.PENDING] }, createdAt: { gte: since } },
    select: { id: true, amount: true, metadata: true, userId: true, createdAt: true, user: { select: { username: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  const candidates = pool.map((t) => ({
    ...t,
    phone: normalizeKenyanPhone(String((t.metadata as { msisdn?: string } | null)?.msisdn ?? "")),
    amt: Math.round(Number(t.amount)),
  }));

  const used = new Set<string>();
  const matches: { txId: string; userId: string; who: string; phone: string; amount: number; ref: string | null }[] = [];
  const unmatched: { phone: string; amount: number; ref: string | null }[] = [];

  for (const row of paid) {
    const hit = candidates.find((c) => !used.has(c.id) && c.phone === row.phone && c.amt === row.amount);
    if (hit) {
      used.add(hit.id);
      matches.push({ txId: hit.id, userId: hit.userId, who: hit.user?.username ?? hit.user?.email ?? hit.userId, phone: row.phone, amount: row.amount, ref: row.ref });
    } else {
      unmatched.push({ phone: row.phone, amount: row.amount, ref: row.ref });
    }
  }

  const totalToCredit = matches.reduce((s, m) => s + m.amount, 0);

  if (!apply) {
    return Response.json({
      preview: true,
      paidRows: paid.length,
      matched: matches.length,
      unmatched: unmatched.length,
      totalToCredit,
      matches,
      unmatchedRows: unmatched,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  // APPLY — credit each match exactly once.
  let credited = 0, creditedTotal = 0, alreadyDone = 0;
  const now = new Date().toISOString();
  for (const m of matches) {
    await db.$transaction(async (prisma) => {
      const tx = await prisma.transaction.findUnique({ where: { id: m.txId }, select: { amount: true, metadata: true, status: true } });
      if (!tx) return;
      const claimed = await prisma.transaction.updateMany({
        where: { id: m.txId, status: { in: [TransactionStatus.PENDING, TransactionStatus.FAILED] } },
        data: { status: TransactionStatus.COMPLETED, metadata: { ...((tx.metadata as Record<string, unknown>) ?? {}), manualLipaRecovery: true, lipaReceipt: m.ref ?? undefined, recoveredBy: adminId, recoveredAt: now } },
      });
      if (claimed.count) {
        await prisma.user.update({ where: { id: m.userId }, data: { walletBalance: { increment: tx.amount } } });
        await grantFirstDepositBonus(prisma, m.userId, Number(tx.amount), m.txId);
        credited++;
        creditedTotal += Number(tx.amount);
      } else {
        alreadyDone++;
      }
    });
  }

  return Response.json({ applied: true, credited, creditedTotal, alreadyCredited: alreadyDone, attempted: matches.length }, { headers: { "Cache-Control": "no-store" } });
}
