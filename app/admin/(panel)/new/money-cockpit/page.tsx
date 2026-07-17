import { db } from "@/lib/db";
import { getExcludedUserIds } from "@/lib/admin-excluded";
import { rangeWindow, nairobiDayKey, getMarketScorecards } from "@/lib/admin/metrics";
import {
  ADMIN_FIAT_DEPOSIT_PROVIDERS, ADMIN_FIAT_WITHDRAWAL_PROVIDERS,
  ADMIN_CRYPTO_DEPOSIT_PROVIDERS, ADMIN_CRYPTO_WITHDRAWAL_PROVIDERS,
} from "@/lib/admin/real-money";
import { CryptoHub } from "@/components/admin-v2/crypto-hub";
import { AdminV2Money } from "@/components/admin-v2/money";

export const metadata = { title: "Money · Nezeem Admin" };
export const dynamic = "force-dynamic";

// The money screen: one date filter drives EVERY number on the page. Tabs split
// the money routes — Lipa Haraka (real KES), Crypto (on-chain), P2P (exchange).
// Real providers only, suspended/test accounts excluded, promo shown separately.

const fmt = (n: number) => n.toLocaleString("en-KE", { maximumFractionDigits: 0 });
const sum = (rows: { amount: unknown }[]) => rows.reduce((s, r) => s + Number(r.amount), 0);

const RANGES: [string, string][] = [["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"], ["30d", "Last 30 days"]];
const TABS: [string, string][] = [["lipa", "Lipa Haraka"], ["crypto", "Crypto"], ["p2p", "P2P"], ["treasury", "Treasury"], ["details", "Payouts & float"]];

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const range = RANGES.some(([r]) => r === sp.range) ? sp.range! : "today";
  const tab = TABS.some(([t]) => t === sp.tab) ? sp.tab! : "lipa";
  const w = rangeWindow(range);
  const inWin = { createdAt: { gte: w.start, lt: w.end } };

  const excluded = await getExcludedUserIds();
  const notExcluded = excluded.length ? { userId: { notIn: excluded } } : {};
  const fiatDep = [...ADMIN_FIAT_DEPOSIT_PROVIDERS];
  const fiatWd = [...ADMIN_FIAT_WITHDRAWAL_PROVIDERS];

  // ── Heroes (always shown, reflect the selected range) ──────────────────────
  const [cashInRows, cashOutRows, promoRows, markets] = await Promise.all([
    db.transaction.findMany({ where: { type: "DEPOSIT", status: "COMPLETED", currency: "KES", provider: { in: fiatDep }, ...inWin, ...notExcluded }, select: { amount: true } }),
    db.transaction.findMany({ where: { type: "WITHDRAWAL", status: "COMPLETED", currency: "KES", provider: { in: fiatWd }, ...inWin, ...notExcluded }, select: { amount: true } }),
    db.transaction.findMany({ where: { type: "DEPOSIT", status: "COMPLETED", provider: "admin_incoin_grant", ...inWin }, select: { amount: true } }),
    getMarketScorecards({ window: w, country: "KE" }),
  ]);
  const cashIn = sum(cashInRows);
  const cashOut = sum(cashOutRows);
  const net = cashIn - cashOut;
  const promo = sum(promoRows);
  const ggr = markets.reduce((s, m) => s + m.ggr, 0);
  const turnover = markets.reduce((s, m) => s + m.turnover, 0);

  const href = (r: string, t: string) => `?range=${r}&tab=${t}`;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#adc6ff]">Money · real cash only</p>
        <h2 className="mt-1 text-[32px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">Money</h2>
        <p className="mt-1 text-[14px] text-[#c2c6d6]">Genuine providers only · suspended &amp; test accounts excluded · promo shown separately, never as cash.</p>
      </div>

      {/* Global date filter — drives every number below */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {RANGES.map(([r, label]) => (
          <a key={r} href={href(r, tab)}
            className={`rounded-md px-3 py-2 text-[12px] font-semibold transition ${range === r ? "bg-[#3a4a5f] text-[#adc6ff]" : "bg-[#161618] text-[#c2c6d6] hover:text-[#e5e2e3]"}`}>
            {label}
          </a>
        ))}
      </div>

      {/* Heroes: cash health + gaming profit for the selected range */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Hero label={`Net cash flow · ${range}`} value={`${net < 0 ? "−" : "+"}KSh ${fmt(Math.abs(net))}`} good={net >= 0}
          sub={net >= 0 ? "Real money in beat money out." : "Paid out more than came in."} />
        <Hero label={`House gaming revenue (GGR) · ${range}`} value={`${ggr < 0 ? "−" : "+"}KSh ${fmt(Math.abs(ggr))}`} good={ggr >= 0}
          sub={`Stakes − payouts · turnover KSh ${fmt(turnover)}`} />
      </div>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Bento label="Cash IN" value={`KSh ${fmt(cashIn)}`} sub={`${cashInRows.length} deposits`} tone="good" />
        <Bento label="Cash OUT" value={`KSh ${fmt(cashOut)}`} sub={`${cashOutRows.length} withdrawals`} />
        <Bento label="Promo given (NOT cash)" value={`KSh ${fmt(promo)}`} sub="play-only marketing" muted />
        <Bento label="Markets live" value={String(markets.filter((m) => m.turnover > 0).length)} sub="with turnover" />
      </div>

      {/* Per-market GGR breakdown — click a row for full market detail */}
      <div className="mb-8 av2-card overflow-hidden rounded-lg">
        <div className="border-b border-[#27272a] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">
          By market · {range} — where the GGR comes from
        </div>
        <div className="overflow-x-auto">
          <table className="av2-mono w-full min-w-[560px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#27272a] bg-[#161618] text-[11px] uppercase tracking-wider text-[#c2c6d6]">
                <th className="px-4 py-2">Market</th>
                <th className="px-4 py-2 text-right">Turnover</th>
                <th className="px-4 py-2 text-right">GGR</th>
                <th className="px-4 py-2 text-right">Margin</th>
                <th className="px-4 py-2 text-right">Open liability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {[...markets].sort((a, b) => b.ggr - a.ggr).map((m) => (
                <tr key={m.key} className="hover:bg-[#1c1b1c]">
                  <td className="px-4 py-2">
                    <a href={`/admin/new/markets/${m.key}`} className="text-[#adc6ff] hover:underline">{m.label}</a>
                  </td>
                  <td className="px-4 py-2 text-right text-[#c2c6d6]">KSh {fmt(m.turnover)}</td>
                  <td className={`px-4 py-2 text-right ${m.ggr < 0 ? "text-[#ffb786]" : "text-[#7ee787]"}`}>{m.ggr < 0 ? "−" : "+"}KSh {fmt(Math.abs(m.ggr))}</td>
                  <td className="px-4 py-2 text-right text-[#8c909f]">{(m.margin * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2 text-right text-[#c2c6d6]">KSh {fmt(m.openLiability)}{m.liabilityExact ? "" : "≈"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabs — money routes, filtered by the same range */}
      <div className="mb-4 flex gap-1.5 border-b border-[#27272a]">
        {TABS.map(([t, label]) => (
          <a key={t} href={href(range, t)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] font-semibold transition ${tab === t ? "border-[#adc6ff] text-[#e5e2e3]" : "border-transparent text-[#8c909f] hover:text-[#c2c6d6]"}`}>
            {label}
          </a>
        ))}
      </div>

      {tab === "lipa" && <LipaTab window={w} notExcluded={notExcluded} />}
      {tab === "crypto" && <CryptoTab window={w} notExcluded={notExcluded} />}
      {tab === "p2p" && <P2PTab window={w} />}
      {tab === "treasury" && <CryptoHub />}
      {tab === "details" && <AdminV2Money initialTab="cashflow" />}
    </div>
  );
}

// ── Lipa Haraka: real KES in/out with daily breakdown ────────────────────────
async function LipaTab({ window: w, notExcluded }: { window: { start: Date; end: Date }; notExcluded: object }) {
  const inWin = { createdAt: { gte: w.start, lt: w.end } };
  const [deps, wds, failed, hookRow] = await Promise.all([
    db.transaction.findMany({ where: { type: "DEPOSIT", status: "COMPLETED", provider: "lipaharaka", ...inWin, ...notExcluded }, select: { amount: true, createdAt: true } }),
    db.transaction.findMany({ where: { type: "WITHDRAWAL", status: "COMPLETED", provider: "lipaharaka", ...inWin, ...notExcluded }, select: { amount: true, createdAt: true } }),
    db.transaction.count({ where: { type: "DEPOSIT", status: "FAILED", provider: "lipaharaka", ...inWin, ...notExcluded } }),
    db.systemSetting.findUnique({ where: { key: "lipa_webhook_status" }, select: { value: true } }),
  ]);
  let hook: { at?: string; method?: string } = {};
  try { hook = hookRow?.value ? JSON.parse(hookRow.value) : {}; } catch { /* ignore */ }
  const hookTone = hook.method === "signature" ? "text-[#7ee787]" : hook.method === "ip" ? "text-[#ffb786]" : hook.method === "rejected" ? "text-[#ff7b72]" : "text-[#8c909f]";
  const hookLabel = hook.method === "signature" ? "signature verified ✓" : hook.method === "ip" ? "IP fallback (set the webhook secret)" : hook.method === "rejected" ? "REJECTED — secret/IP mismatch" : "no callback seen yet";
  const byDay: Record<string, { in: number; out: number }> = {};
  for (const r of deps) (byDay[nairobiDayKey(r.createdAt)] ??= { in: 0, out: 0 }).in += Number(r.amount);
  for (const r of wds) (byDay[nairobiDayKey(r.createdAt)] ??= { in: 0, out: 0 }).out += Number(r.amount);
  const rows = Object.entries(byDay).map(([d, v]) => ({ d, ...v, net: v.in - v.out })).sort((a, b) => b.d.localeCompare(a.d));
  const tIn = sum(deps), tOut = sum(wds);
  return (
    <>
      <div className="mb-2 text-[13px] text-[#c2c6d6]">
        Cash in <b className="text-[#7ee787]">KSh {fmt(tIn)}</b> · out <b className="text-[#e5e2e3]">KSh {fmt(tOut)}</b> · failed deposits <b className="text-[#ffb786]">{failed}</b>
      </div>
      <div className="mb-4 text-[12px] text-[#8c909f]">
        Webhook: <b className={hookTone}>{hookLabel}</b>
        {hook.at && <> · last callback {new Date(hook.at).toLocaleString("en-KE")}</>}
      </div>
      <MoneyTable rows={rows} />
    </>
  );
}

// ── Crypto: on-chain in/out by asset (native units, not KES-valued) ──────────
async function CryptoTab({ window: w, notExcluded }: { window: { start: Date; end: Date }; notExcluded: object }) {
  const inWin = { createdAt: { gte: w.start, lt: w.end } };
  const [deps, wds] = await Promise.all([
    db.transaction.groupBy({ by: ["currency"], where: { type: "DEPOSIT", status: "COMPLETED", provider: { in: [...ADMIN_CRYPTO_DEPOSIT_PROVIDERS] }, ...inWin, ...notExcluded }, _sum: { amount: true }, _count: { _all: true } }),
    db.transaction.groupBy({ by: ["currency"], where: { type: "WITHDRAWAL", status: "COMPLETED", provider: { in: [...ADMIN_CRYPTO_WITHDRAWAL_PROVIDERS] }, ...inWin, ...notExcluded }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  const cur = new Set([...deps.map((d) => d.currency), ...wds.map((d) => d.currency)]);
  const depMap = new Map(deps.map((d) => [d.currency, d]));
  const wdMap = new Map(wds.map((d) => [d.currency, d]));
  return (
    <div className="av2-card overflow-hidden rounded-lg">
      <table className="av2-mono w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-[#27272a] bg-[#161618] text-[11px] uppercase tracking-wider text-[#c2c6d6]">
            <th className="px-4 py-3">Asset</th><th className="px-4 py-3 text-right">Deposits</th><th className="px-4 py-3 text-right">Withdrawals</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#27272a]">
          {cur.size === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-[#8c909f]">No crypto movement in this range.</td></tr>}
          {[...cur].map((c) => (
            <tr key={c}>
              <td className="px-4 py-2 text-[#e5e2e3]">{c}</td>
              <td className="px-4 py-2 text-right text-[#7ee787]">{fmt(Number(depMap.get(c)?._sum.amount ?? 0))} <span className="text-[#8c909f]">({depMap.get(c)?._count._all ?? 0})</span></td>
              <td className="px-4 py-2 text-right text-[#e5e2e3]">{fmt(Number(wdMap.get(c)?._sum.amount ?? 0))} <span className="text-[#8c909f]">({wdMap.get(c)?._count._all ?? 0})</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-[#27272a] px-4 py-2 text-[11px] text-[#8c909f]">On-chain amounts in native units (not KES-valued). Live balances on the Crypto balances page.</div>
    </div>
  );
}

// ── P2P: exchange volume (money moving between users) ─────────────────────────
async function P2PTab({ window: w }: { window: { start: Date; end: Date } }) {
  const orders = await db.p2POrder.findMany({
    where: { status: "RELEASED", createdAt: { gte: w.start, lt: w.end } },
    select: { fiatAmount: true, crypto: true },
  });
  const vol = orders.reduce((s, o) => s + Number(o.fiatAmount), 0);
  const byCoin: Record<string, { count: number; vol: number }> = {};
  for (const o of orders) { (byCoin[o.crypto] ??= { count: 0, vol: 0 }).count++; byCoin[o.crypto].vol += Number(o.fiatAmount); }
  const rows = Object.entries(byCoin).map(([c, v]) => ({ c, ...v })).sort((a, b) => b.vol - a.vol);
  return (
    <>
      <div className="mb-4 text-[13px] text-[#c2c6d6]">Completed P2P volume <b className="text-[#e5e2e3]">KSh {fmt(vol)}</b> across <b>{orders.length}</b> orders.</div>
      <div className="av2-card overflow-hidden rounded-lg">
        <table className="av2-mono w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#27272a] bg-[#161618] text-[11px] uppercase tracking-wider text-[#c2c6d6]">
              <th className="px-4 py-3">Coin</th><th className="px-4 py-3 text-right">Orders</th><th className="px-4 py-3 text-right">Volume (KSh)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#27272a]">
            {rows.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-[#8c909f]">No completed P2P orders in this range.</td></tr>}
            {rows.map((r) => (
              <tr key={r.c}><td className="px-4 py-2 text-[#e5e2e3]">{r.c}</td><td className="px-4 py-2 text-right text-[#c2c6d6]">{r.count}</td><td className="px-4 py-2 text-right text-[#e5e2e3]">KSh {fmt(r.vol)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MoneyTable({ rows }: { rows: { d: string; in: number; out: number; net: number }[] }) {
  return (
    <div className="av2-card overflow-hidden rounded-lg">
      <table className="av2-mono w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-[#27272a] bg-[#161618] text-[11px] uppercase tracking-wider text-[#c2c6d6]">
            <th className="px-4 py-3">Day</th><th className="px-4 py-3 text-right">In</th><th className="px-4 py-3 text-right">Out</th><th className="px-4 py-3 text-right">Net</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#27272a]">
          {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-[#8c909f]">No activity in this range.</td></tr>}
          {rows.map((r) => (
            <tr key={r.d} className="hover:bg-[#1c1b1c]">
              <td className="px-4 py-2 text-[#e5e2e3]">{r.d}</td>
              <td className="px-4 py-2 text-right text-[#7ee787]">KSh {fmt(r.in)}</td>
              <td className="px-4 py-2 text-right text-[#e5e2e3]">KSh {fmt(r.out)}</td>
              <td className={`px-4 py-2 text-right ${r.net < 0 ? "text-[#ffb786]" : "text-[#e5e2e3]"}`}>KSh {fmt(r.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Hero({ label, value, sub, good }: { label: string; value: string; sub: string; good: boolean }) {
  return (
    <div className="av2-card rounded-lg p-6">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">{label}</div>
      <div className={`av2-mono mt-1 text-[40px] font-semibold leading-none ${good ? "text-[#7ee787]" : "text-[#ffb786]"}`}>{value}</div>
      <div className="mt-2 text-[13px] text-[#8c909f]">{sub}</div>
    </div>
  );
}

function Bento({ label, value, sub, tone, muted }: { label: string; value: string; sub?: string; tone?: "good"; muted?: boolean }) {
  const color = muted ? "text-[#c2c6d6]" : tone === "good" ? "text-[#7ee787]" : "text-[#e5e2e3]";
  return (
    <div className="av2-card relative flex h-28 flex-col justify-between overflow-hidden rounded-lg p-4">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">{label}</span>
      <div><div className={`av2-mono text-[22px] font-semibold ${color}`}>{value}</div>{sub && <div className="text-[11px] text-[#8c909f]">{sub}</div>}</div>
    </div>
  );
}
