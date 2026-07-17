import { db } from "@/lib/db";

export const metadata = { title: "Cashflow · 7 days · Nezeem Admin" };
export const dynamic = "force-dynamic";

// READ-ONLY: deposits vs withdrawals over the last 7 days (Africa/Nairobi days),
// straight from Nezeem's transaction ledger. Completed = real money moved;
// failed/pending shown for context. Writes nothing.

const TZ_OFFSET_H = 3; // Africa/Nairobi (UTC+3)
const DAY_MS = 24 * 3600_000;
const fmt = (n: number) => n.toLocaleString("en-KE", { maximumFractionDigits: 0 });
const nboDay = (d: Date) => new Date(d.getTime() + TZ_OFFSET_H * 3600_000).toISOString().slice(0, 10);

type Cell = { count: number; sum: number };
const empty = (): Cell => ({ count: 0, sum: 0 });

export default async function Cashflow7dPage() {
  const since = new Date(Date.now() - 7 * DAY_MS);

  const rows = await db.transaction.findMany({
    where: { createdAt: { gte: since }, type: { in: ["DEPOSIT", "WITHDRAWAL"] } },
    select: { type: true, status: true, amount: true, provider: true, createdAt: true },
  });

  // day -> { depDone, depFail, depPend, wdDone, wdFail, wdPend }
  const days: Record<string, {
    depDone: Cell; depFail: Cell; depPend: Cell; wdDone: Cell; wdFail: Cell; wdPend: Cell;
  }> = {};
  const provider: Record<string, Cell> = {}; // completed deposits by provider (7d)
  const totals = { depDone: empty(), depFail: empty(), depPend: empty(), wdDone: empty(), wdFail: empty(), wdPend: empty() };

  for (const r of rows) {
    const day = nboDay(r.createdAt);
    days[day] ??= { depDone: empty(), depFail: empty(), depPend: empty(), wdDone: empty(), wdFail: empty(), wdPend: empty() };
    const amt = Number(r.amount);
    const isDep = r.type === "DEPOSIT";
    const done = r.status === "COMPLETED";
    const fail = r.status === "FAILED";
    const bucket =
      isDep ? (done ? "depDone" : fail ? "depFail" : "depPend")
            : (done ? "wdDone" : fail ? "wdFail" : "wdPend");
    days[day][bucket as keyof (typeof days)[string]].count++;
    days[day][bucket as keyof (typeof days)[string]].sum += amt;
    totals[bucket as keyof typeof totals].count++;
    totals[bucket as keyof typeof totals].sum += amt;
    if (isDep && done) {
      const p = r.provider ?? "(none)";
      provider[p] ??= empty();
      provider[p].count++;
      provider[p].sum += amt;
    }
  }

  const dayKeys = Object.keys(days).sort().reverse();
  const provRows = Object.entries(provider).map(([p, c]) => ({ p, ...c })).sort((a, b) => b.sum - a.sum);
  const netWeek = totals.depDone.sum - totals.wdDone.sum;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#adc6ff]">Reconciliation</p>
        <h2 className="mt-1 text-[32px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">Cashflow — last 7 days</h2>
        <p className="mt-1 text-[14px] text-[#c2c6d6]">
          Deposits vs withdrawals from Nezeem&apos;s ledger (Africa/Nairobi days). &ldquo;Done&rdquo; = COMPLETED (real money moved).
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Bento label="Deposits IN (7d, done)" value={`KSh ${fmt(totals.depDone.sum)}`} sub={`${totals.depDone.count} txns`} />
        <Bento label="Withdrawals OUT (7d, done)" value={`KSh ${fmt(totals.wdDone.sum)}`} sub={`${totals.wdDone.count} txns`} tone={totals.wdDone.sum > totals.depDone.sum ? "warn" : undefined} />
        <Bento label="Net (in − out)" value={`KSh ${fmt(netWeek)}`} tone={netWeek < 0 ? "warn" : undefined} />
        <Bento label="Failed deposits (7d)" value={String(totals.depFail.count)} sub={`KSh ${fmt(totals.depFail.sum)} attempted`} tone={totals.depFail.count > 0 ? "warn" : undefined} />
      </div>

      <div className="mb-8 av2-card overflow-hidden rounded-lg">
        <div className="overflow-x-auto">
          <table className="av2-mono w-full min-w-[820px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#27272a] bg-[#161618] text-[11px] uppercase tracking-wider text-[#c2c6d6]">
                <th className="px-4 py-3 font-semibold">Day</th>
                <th className="px-4 py-3 text-right font-semibold">Deposits ✓</th>
                <th className="px-4 py-3 text-right font-semibold">Dep failed</th>
                <th className="px-4 py-3 text-right font-semibold">Withdrawals ✓</th>
                <th className="px-4 py-3 text-right font-semibold">Wd pending</th>
                <th className="px-4 py-3 text-right font-semibold">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {dayKeys.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[#8c909f]">No deposits or withdrawals in the last 7 days.</td></tr>
              )}
              {dayKeys.map((k) => {
                const d = days[k];
                const net = d.depDone.sum - d.wdDone.sum;
                return (
                  <tr key={k} className="hover:bg-[#1c1b1c]">
                    <td className="px-4 py-3 text-[#e5e2e3]">{k}</td>
                    <td className="px-4 py-3 text-right text-[#e5e2e3]">KSh {fmt(d.depDone.sum)} <span className="text-[#8c909f]">({d.depDone.count})</span></td>
                    <td className="px-4 py-3 text-right text-[#ffb786]">{d.depFail.count || "—"}</td>
                    <td className="px-4 py-3 text-right text-[#e5e2e3]">KSh {fmt(d.wdDone.sum)} <span className="text-[#8c909f]">({d.wdDone.count})</span></td>
                    <td className="px-4 py-3 text-right text-[#c2c6d6]">{d.wdPend.count || "—"}</td>
                    <td className={`px-4 py-3 text-right ${net < 0 ? "text-[#ffb786]" : "text-[#e5e2e3]"}`}>KSh {fmt(net)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#424754] bg-[#161618] font-semibold">
                <td className="px-4 py-3 text-[#e5e2e3]">TOTAL</td>
                <td className="px-4 py-3 text-right text-[#e5e2e3]">KSh {fmt(totals.depDone.sum)} <span className="text-[#8c909f]">({totals.depDone.count})</span></td>
                <td className="px-4 py-3 text-right text-[#ffb786]">{totals.depFail.count || "—"}</td>
                <td className="px-4 py-3 text-right text-[#e5e2e3]">KSh {fmt(totals.wdDone.sum)} <span className="text-[#8c909f]">({totals.wdDone.count})</span></td>
                <td className="px-4 py-3 text-right text-[#c2c6d6]">{totals.wdPend.count || "—"}</td>
                <td className={`px-4 py-3 text-right ${netWeek < 0 ? "text-[#ffb786]" : "text-[#e5e2e3]"}`}>KSh {fmt(netWeek)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="av2-card overflow-hidden rounded-lg">
        <div className="border-b border-[#27272a] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">
          Completed deposits by provider (7 days)
        </div>
        <table className="av2-mono w-full text-left text-[13px]">
          <tbody className="divide-y divide-[#27272a]">
            {provRows.length === 0 && (
              <tr><td className="px-4 py-3 text-[#8c909f]">No completed deposits.</td></tr>
            )}
            {provRows.map((r) => (
              <tr key={r.p}>
                <td className="px-4 py-2 text-[#e5e2e3]">{r.p}</td>
                <td className="px-4 py-2 text-right text-[#c2c6d6]">{r.count}</td>
                <td className="px-4 py-2 text-right text-[#e5e2e3]">KSh {fmt(r.sum)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-[#27272a] px-4 py-2 text-[11px] text-[#8c909f]">
          Compare the <span className="text-[#adc6ff]">lipaharaka</span> total to Lipa&apos;s &ldquo;Total collected&rdquo; for the same window.
        </div>
      </div>
    </div>
  );
}

function Bento({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  const color = tone === "warn" ? "text-[#ffb786]" : "text-[#e5e2e3]";
  return (
    <div className="av2-card relative flex h-28 flex-col justify-between overflow-hidden rounded-lg p-4">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">{label}</span>
      <div>
        <div className={`av2-mono text-[24px] font-semibold ${color}`}>{value}</div>
        {sub && <div className="text-[11px] text-[#8c909f]">{sub}</div>}
      </div>
    </div>
  );
}
