import { db } from "@/lib/db";

export const metadata = { title: "Lipa Audit · Nezeem Admin" };
export const dynamic = "force-dynamic";

// READ-ONLY reconciliation of Lipa Haraka deposits for a given day (Africa/Nairobi).
// Surfaces FAILED/PENDING attempts to cross-check against Lipa's "paid" list, so
// uncredited payers can be found and manually credited. Writes nothing.

const TZ_OFFSET_H = 3; // Africa/Nairobi (UTC+3)
const fmt = (n: number) => n.toLocaleString("en-KE", { maximumFractionDigits: 0 });

export default async function LipaAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const nowNbo = new Date(Date.now() + TZ_OFFSET_H * 3600_000);
  const ymd = (sp.date ?? nowNbo.toISOString().slice(0, 10)).trim();
  const startUtc = new Date(`${ymd}T00:00:00.000Z`).getTime() - TZ_OFFSET_H * 3600_000;
  const from = new Date(startUtc);
  const to = new Date(startUtc + 24 * 3600_000);

  const deps = await db.transaction.findMany({
    where: { provider: "lipaharaka", type: "DEPOSIT", createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: "asc" },
    select: { id: true, amount: true, status: true, reference: true, metadata: true, createdAt: true,
      user: { select: { username: true, email: true } } },
  });

  // ── Lifetime reconciliation: where did deposits actually come from, and how
  //    does total money-in compare to total money-out? ────────────────────────
  const [depByProvider, wdByProvider] = await Promise.all([
    db.transaction.groupBy({ by: ["provider"], where: { type: "DEPOSIT", status: "COMPLETED" }, _sum: { amount: true }, _count: { _all: true } }),
    db.transaction.groupBy({ by: ["provider"], where: { type: "WITHDRAWAL", status: "COMPLETED" }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  const provRows = depByProvider
    .map((r) => ({ provider: r.provider ?? "(none)", count: r._count._all, sum: Number(r._sum.amount ?? 0) }))
    .sort((a, b) => b.sum - a.sum);
  const totalDepIn = provRows.reduce((s, r) => s + r.sum, 0);
  const totalWdOut = wdByProvider.reduce((s, r) => s + Number(r._sum.amount ?? 0), 0);

  const byStatus: Record<string, { count: number; sum: number }> = {};
  for (const d of deps) {
    const s = String(d.status);
    byStatus[s] ??= { count: 0, sum: 0 };
    byStatus[s].count++;
    byStatus[s].sum += Number(d.amount);
  }
  const completed = byStatus.COMPLETED?.sum ?? 0;
  const suspect = deps.filter((d) => d.status === "FAILED" || d.status === "PENDING");
  const suspectSum = suspect.reduce((s, d) => s + Number(d.amount), 0);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#adc6ff]">Reconciliation</p>
        <h2 className="mt-1 text-[32px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">Lipa Haraka audit</h2>
        <p className="mt-1 text-[14px] text-[#c2c6d6]">
          Deposits for {ymd} (Africa/Nairobi). Cross-check FAILED/PENDING rows against Lipa&apos;s
          &ldquo;paid&rdquo; list — any that Lipa shows as paid is an uncredited payer.
        </p>
      </div>

      {/* Lifetime money-in vs money-out — answers "where did deposits go / come from" */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Bento label="Lifetime deposits IN (COMPLETED)" value={`KSh ${fmt(totalDepIn)}`} />
        <Bento label="Lifetime withdrawals OUT (COMPLETED)" value={`KSh ${fmt(totalWdOut)}`} tone={totalWdOut > totalDepIn ? "warn" : undefined} />
        <Bento label="Net (in − out)" value={`KSh ${fmt(totalDepIn - totalWdOut)}`} tone={totalDepIn - totalWdOut < 0 ? "warn" : undefined} />
      </div>

      <div className="mb-8 av2-card overflow-hidden rounded-lg">
        <div className="border-b border-[#27272a] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">
          Completed deposits by provider (all time)
        </div>
        <table className="av2-mono w-full text-left text-[13px]">
          <tbody className="divide-y divide-[#27272a]">
            {provRows.length === 0 && (
              <tr><td className="px-4 py-3 text-[#8c909f]">No completed deposits recorded.</td></tr>
            )}
            {provRows.map((r) => (
              <tr key={r.provider}>
                <td className="px-4 py-2 text-[#e5e2e3]">{r.provider}</td>
                <td className="px-4 py-2 text-right text-[#c2c6d6]">{r.count}</td>
                <td className="px-4 py-2 text-right text-[#e5e2e3]">KSh {fmt(r.sum)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-[#27272a] px-4 py-2 text-[11px] text-[#8c909f]">
          Compare the <span className="text-[#adc6ff]">lipaharaka</span> row here to Lipa&apos;s dashboard &ldquo;Total collected&rdquo;. A big gap means either deposits came via another channel, or deposits were credited that the provider never collected.
        </div>
      </div>

      <form method="get" className="mb-6 flex gap-2">
        <input
          type="date" name="date" defaultValue={ymd}
          className="rounded-md border border-[#27272a] bg-[#161618] px-3 py-2 text-[13px] text-[#e5e2e3] outline-none focus:border-[#adc6ff]"
        />
        <button className="rounded-md bg-[#3a4a5f] px-4 py-2 text-[12px] font-semibold text-[#adc6ff]">View</button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Bento label="Attempts" value={String(deps.length)} />
        <Bento label="Credited (COMPLETED)" value={`KSh ${fmt(completed)}`} />
        <Bento label="FAILED / PENDING" value={String(suspect.length)} tone="warn" />
        <Bento label="Suspect value" value={`KSh ${fmt(suspectSum)}`} tone="warn" />
      </div>

      <div className="av2-card overflow-hidden rounded-lg">
        <div className="border-b border-[#27272a] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">
          Status breakdown
        </div>
        <table className="av2-mono w-full text-left text-[13px]">
          <tbody className="divide-y divide-[#27272a]">
            {Object.entries(byStatus).sort().map(([s, v]) => (
              <tr key={s}>
                <td className="px-4 py-2 text-[#e5e2e3]">{s}</td>
                <td className="px-4 py-2 text-right text-[#c2c6d6]">{v.count}</td>
                <td className="px-4 py-2 text-right text-[#e5e2e3]">KSh {fmt(v.sum)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 av2-card overflow-hidden rounded-lg">
        <div className="border-b border-[#27272a] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#ffb786]">
          ⚠ FAILED / PENDING — cross-check vs Lipa &ldquo;paid&rdquo;
        </div>
        {suspect.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#8c909f]">Nothing to reconcile for {ymd}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="av2-mono w-full min-w-[760px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#27272a] bg-[#161618] text-[11px] uppercase tracking-wider text-[#c2c6d6]">
                  <th className="px-4 py-3 font-semibold">Time (UTC)</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Msisdn</th>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Ref / reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]">
                {suspect.map((d) => {
                  const m = (d.metadata as { msisdn?: string; failureReason?: string } | null) ?? {};
                  return (
                    <tr key={d.id} className="hover:bg-[#1c1b1c]">
                      <td className="px-4 py-3 text-[#c2c6d6]">{d.createdAt.toISOString().slice(11, 19)}</td>
                      <td className="px-4 py-3 text-right text-[#e5e2e3]">KSh {fmt(Number(d.amount))}</td>
                      <td className="px-4 py-3 text-[#e5e2e3]">{String(d.status)}</td>
                      <td className="px-4 py-3 text-[#c2c6d6]">{m.msisdn ?? "?"}</td>
                      <td className="px-4 py-3 text-[#8c909f]">{d.user?.username ?? d.user?.email ?? "—"}</td>
                      <td className="px-4 py-3 text-[#8c909f]">{d.reference ?? m.failureReason ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Bento({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  const color = tone === "warn" ? "text-[#ffb786]" : "text-[#e5e2e3]";
  return (
    <div className="av2-card relative flex h-28 flex-col justify-between overflow-hidden rounded-lg p-4">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">{label}</span>
      <span className={`av2-mono text-[26px] font-semibold ${color}`}>{value}</span>
    </div>
  );
}
