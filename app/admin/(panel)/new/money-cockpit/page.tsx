import { db } from "@/lib/db";
import { getExcludedUserIds } from "@/lib/admin-excluded";
import { nairobiMidnight, nairobiDayKey, todayWindow } from "@/lib/admin/metrics";
import { ADMIN_FIAT_DEPOSIT_PROVIDERS, ADMIN_FIAT_WITHDRAWAL_PROVIDERS } from "@/lib/admin/real-money";

export const metadata = { title: "Money · Nezeem Admin" };
export const dynamic = "force-dynamic";

// The "wow" money screen: real M-Pesa cash truth at a glance. Real providers
// only, suspended/test accounts (binary exploiters) excluded, promo shown as
// its OWN line so marketing credit is never mistaken for cash. Read-only.

const fmt = (n: number) => n.toLocaleString("en-KE", { maximumFractionDigits: 0 });
const sum = (rows: { amount: unknown }[]) => rows.reduce((s, r) => s + Number(r.amount), 0);

export default async function MoneyCockpitPage() {
  const today = todayWindow();
  const monthStart = nairobiMidnight(29); // last 30 Nairobi days incl. today
  const excluded = await getExcludedUserIds();
  const notExcluded = excluded.length ? { userId: { notIn: excluded } } : {};
  const fiatDep = [...ADMIN_FIAT_DEPOSIT_PROVIDERS];
  const fiatWd = [...ADMIN_FIAT_WITHDRAWAL_PROVIDERS];

  const [
    inToday, outToday, failedToday, promoToday, p2pToday,
    inMonth, outMonth,
  ] = await Promise.all([
    db.transaction.findMany({ where: { type: "DEPOSIT", status: "COMPLETED", currency: "KES", provider: { in: fiatDep }, createdAt: { gte: today.start, lt: today.end }, ...notExcluded }, select: { amount: true } }),
    db.transaction.findMany({ where: { type: "WITHDRAWAL", status: "COMPLETED", currency: "KES", provider: { in: fiatWd }, createdAt: { gte: today.start, lt: today.end }, ...notExcluded }, select: { amount: true } }),
    db.transaction.count({ where: { type: "DEPOSIT", status: "FAILED", provider: "lipaharaka", createdAt: { gte: today.start, lt: today.end }, ...notExcluded } }),
    db.transaction.findMany({ where: { type: "DEPOSIT", status: "COMPLETED", provider: "admin_incoin_grant", createdAt: { gte: today.start, lt: today.end } }, select: { amount: true } }),
    db.p2POrder.findMany({ where: { status: "RELEASED", createdAt: { gte: today.start, lt: today.end } }, select: { fiatAmount: true } }),
    db.transaction.findMany({ where: { type: "DEPOSIT", status: "COMPLETED", currency: "KES", provider: { in: fiatDep }, createdAt: { gte: monthStart }, ...notExcluded }, select: { amount: true, createdAt: true } }),
    db.transaction.findMany({ where: { type: "WITHDRAWAL", status: "COMPLETED", currency: "KES", provider: { in: fiatWd }, createdAt: { gte: monthStart }, ...notExcluded }, select: { amount: true, createdAt: true } }),
  ]);

  const cashIn = sum(inToday);
  const cashOut = sum(outToday);
  const net = cashIn - cashOut;
  const promo = sum(promoToday);
  const p2pVol = p2pToday.reduce((s, o) => s + Number(o.fiatAmount), 0);

  // 30-day daily net cash flow (in − out), real money only.
  const byDay: Record<string, { in: number; out: number }> = {};
  for (const r of inMonth) { const k = nairobiDayKey(r.createdAt); (byDay[k] ??= { in: 0, out: 0 }).in += Number(r.amount); }
  for (const r of outMonth) { const k = nairobiDayKey(r.createdAt); (byDay[k] ??= { in: 0, out: 0 }).out += Number(r.amount); }
  const series = Object.entries(byDay).map(([day, v]) => ({ day, net: v.in - v.out, in: v.in, out: v.out })).sort((a, b) => a.day.localeCompare(b.day));
  const monthIn = inMonth.reduce((s, r) => s + Number(r.amount), 0);
  const monthOut = outMonth.reduce((s, r) => s + Number(r.amount), 0);
  const maxAbs = Math.max(1, ...series.map((s) => Math.abs(s.net)));

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#adc6ff]">Money · real cash only</p>
        <h2 className="mt-1 text-[32px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">Today&apos;s money</h2>
        <p className="mt-1 text-[14px] text-[#c2c6d6]">
          Genuine M-Pesa rails only. Suspended &amp; test accounts excluded. Promo credit is shown
          separately — it is never counted as cash.
        </p>
      </div>

      {/* Hero: the number the owner wants to see */}
      <div className="mb-4 av2-card rounded-lg p-6">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Net cash flow today (in − out)</div>
        <div className={`av2-mono mt-1 text-[48px] font-semibold leading-none ${net < 0 ? "text-[#ffb786]" : "text-[#7ee787]"}`}>
          {net < 0 ? "−" : "+"}KSh {fmt(Math.abs(net))}
        </div>
        <div className="mt-2 text-[13px] text-[#8c909f]">
          {net >= 0 ? "More real money came in than went out today." : "More paid out than came in today."}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Bento label="Cash IN today" value={`KSh ${fmt(cashIn)}`} sub={`${inToday.length} deposits`} tone="good" />
        <Bento label="Cash OUT today" value={`KSh ${fmt(cashOut)}`} sub={`${outToday.length} withdrawals`} />
        <Bento label="P2P volume today" value={`KSh ${fmt(p2pVol)}`} sub={`${p2pToday.length} completed orders`} />
        <Bento label="Failed deposits today" value={String(failedToday)} sub="lower is better" tone={failedToday > 20 ? "warn" : "good"} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Bento label="Promo credit given today (NOT cash)" value={`KSh ${fmt(promo)}`} sub="marketing bonus — excluded from cash" muted />
        <Bento label="Cash IN — last 30 days" value={`KSh ${fmt(monthIn)}`} tone="good" />
        <Bento label="Cash OUT — last 30 days" value={`KSh ${fmt(monthOut)}`} />
      </div>

      {/* 30-day net cashflow bars */}
      <div className="av2-card overflow-hidden rounded-lg p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Net cash flow — last 30 days</span>
          <span className="av2-mono text-[13px] text-[#8c909f]">30d net: {monthIn - monthOut < 0 ? "−" : "+"}KSh {fmt(Math.abs(monthIn - monthOut))}</span>
        </div>
        {series.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#8c909f]">No real cash activity in the last 30 days.</p>
        ) : (
          <div className="flex h-40 items-end gap-1">
            {series.map((s) => {
              const h = Math.round((Math.abs(s.net) / maxAbs) * 100);
              return (
                <div key={s.day} className="group relative flex flex-1 flex-col items-center justify-end" title={`${s.day}: net ${s.net < 0 ? "−" : "+"}KSh ${fmt(Math.abs(s.net))} (in ${fmt(s.in)} / out ${fmt(s.out)})`}>
                  <div className={`w-full rounded-sm ${s.net < 0 ? "bg-[#ffb786]/70" : "bg-[#7ee787]/70"}`} style={{ height: `${Math.max(2, h)}%` }} />
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-2 text-[11px] text-[#8c909f]">Green = net money in that day · amber = net out. Hover a bar for the day.</div>
      </div>
    </div>
  );
}

function Bento({ label, value, sub, tone, muted }: { label: string; value: string; sub?: string; tone?: "good" | "warn"; muted?: boolean }) {
  const color = muted ? "text-[#c2c6d6]" : tone === "good" ? "text-[#7ee787]" : tone === "warn" ? "text-[#ffb786]" : "text-[#e5e2e3]";
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
