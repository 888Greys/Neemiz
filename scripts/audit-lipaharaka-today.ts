/**
 * READ-ONLY audit of today's Lipa Haraka deposits. Prints every deposit grouped
 * by status so you can cross-check against Lipa's dashboard "paid" list and find
 * payers who were NOT credited (FAILED/PENDING here but "paid" on Lipa).
 *
 * Writes nothing. Safe to run against production.
 *
 *   DATABASE_URL=<prod> bun run scripts/audit-lipaharaka-today.ts [YYYY-MM-DD]
 *
 * Date defaults to today in Africa/Nairobi (UTC+3). Pass a date to audit another day.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Day window in Africa/Nairobi (UTC+3), expressed as UTC instants.
const TZ_OFFSET_H = 3;
const arg = process.argv[2];
const nowNbo = new Date(Date.now() + TZ_OFFSET_H * 3600_000);
const ymd = arg ?? nowNbo.toISOString().slice(0, 10);
const start = new Date(`${ymd}T00:00:00.000Z`).getTime() - TZ_OFFSET_H * 3600_000;
const from = new Date(start);
const to = new Date(start + 24 * 3600_000);

const deps = await db.transaction.findMany({
  where: { provider: "lipaharaka", type: "DEPOSIT", createdAt: { gte: from, lt: to } },
  orderBy: { createdAt: "asc" },
  select: { id: true, userId: true, amount: true, status: true, reference: true, metadata: true, createdAt: true },
});

const byStatus: Record<string, { count: number; sum: number }> = {};
for (const d of deps) {
  const s = String(d.status);
  byStatus[s] ??= { count: 0, sum: 0 };
  byStatus[s].count++;
  byStatus[s].sum += Number(d.amount);
}

const fmt = (n: number) => n.toLocaleString("en-KE", { maximumFractionDigits: 0 });
console.log(`\nLipa Haraka DEPOSITS for ${ymd} (Africa/Nairobi)\n`);
console.log(`  total attempts: ${deps.length}`);
for (const [s, v] of Object.entries(byStatus).sort()) console.log(`  ${s.padEnd(10)} ${String(v.count).padStart(4)}   KSh ${fmt(v.sum)}`);
const completed = byStatus.COMPLETED?.sum ?? 0;
console.log(`\n  COMPLETED (credited) total: KSh ${fmt(completed)}`);

// The suspect set: FAILED/PENDING that may actually be "paid" on Lipa.
const suspect = deps.filter((d) => d.status === "FAILED" || d.status === "PENDING");
console.log(`\n  ⚠ ${suspect.length} FAILED/PENDING to cross-check against Lipa "paid":`);
console.log(`  time(UTC)          amount   status    msisdn         ref`);
for (const d of suspect) {
  const m = (d.metadata as { msisdn?: string; failureReason?: string } | null) ?? {};
  console.log(
    `  ${d.createdAt.toISOString().slice(11, 19)}   ${String(fmt(Number(d.amount))).padStart(7)}   ${String(d.status).padEnd(8)}  ${(m.msisdn ?? "?").padEnd(13)}  ${d.reference ?? "-"}${m.failureReason ? `  (${m.failureReason})` : ""}`,
  );
}
console.log(`\n  → Any msisdn/amount above that Lipa shows as PAID is an uncredited payer owed a manual credit.\n`);

await db.$disconnect();
