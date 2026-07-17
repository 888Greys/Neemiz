import { db } from "@/lib/db";
import { getExcludedUserIds } from "@/lib/admin-excluded";
import { REAL_DEPOSIT_PROVIDERS } from "@/lib/promo-lock";

export const metadata = { title: "Liability · Nezeem Admin" };
export const dynamic = "force-dynamic";

// "What do we owe players, and why?" — reframes the scary wallet-liability number.
// Gross balance splits into: real withdrawable cash (the true obligation),
// promo principal that is PLAY-ONLY and can't be withdrawn, and balances held by
// suspended/test accounts (frozen — not owed). Read-only.

const fmt = (n: number) => n.toLocaleString("en-KE", { maximumFractionDigits: 0 });

export default async function LiabilityPage() {
  const excluded = await getExcludedUserIds();
  const excludedSet = new Set(excluded);

  const [users, promoAgg, fundedRows, excludedAgg] = await Promise.all([
    db.user.findMany({ where: { isActive: true, walletBalance: { gt: 0 }, id: { notIn: excluded.length ? excluded : ["__none__"] } }, select: { id: true, username: true, walletBalance: true }, orderBy: { walletBalance: "desc" } }),
    db.promoRedemption.groupBy({ by: ["userId"], _sum: { amountKes: true } }),
    db.transaction.findMany({ where: { type: "DEPOSIT", status: "COMPLETED", provider: { in: [...REAL_DEPOSIT_PROVIDERS] } }, select: { userId: true }, distinct: ["userId"] }),
    db.user.aggregate({ _sum: { walletBalance: true }, where: { id: { in: excluded.length ? excluded : ["__none__"] } } }),
  ]);

  const promoByUser = new Map(promoAgg.map((p) => [p.userId, Number(p._sum.amountKes ?? 0)]));
  const fundedIds = new Set(fundedRows.map((r) => r.userId));

  let gross = 0, promoLockedTotal = 0, realOwed = 0;
  for (const u of users) {
    const bal = Number(u.walletBalance);
    gross += bal;
    const principal = promoByUser.get(u.id) ?? 0;
    const funded = fundedIds.has(u.id);
    // Mirror getPromoLockedKes: funded → lock promo principal; unfunded → lock the
    // whole wallet (nothing withdrawable until a real deposit).
    const lockedRaw = funded ? principal : Math.max(principal, bal);
    const lockedOfWallet = Math.min(lockedRaw, bal);
    promoLockedTotal += lockedOfWallet;
    realOwed += bal - lockedOfWallet;
  }
  // Balance held by accounts that never made a real deposit — internal credit
  // (promo/winnings on promo), not cash you ever received.
  const unfundedFrozen = users
    .filter((u) => !fundedIds.has(u.id))
    .reduce((s, u) => s + Number(u.walletBalance), 0);

  const excludedBalance = Number(excludedAgg._sum.walletBalance ?? 0);
  const top = users.slice(0, 25);
  const topShare = gross > 0 ? (top.reduce((s, u) => s + Number(u.walletBalance), 0) / gross) * 100 : 0;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#adc6ff]">What we owe · and why</p>
        <h2 className="mt-1 text-[32px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">Player liability</h2>
        <p className="mt-1 text-[14px] text-[#c2c6d6]">
          The headline &ldquo;owed to players&rdquo; number, broken down honestly. Most of it isn&apos;t cash you have to find tomorrow.
        </p>
      </div>

      <div className="mb-4 av2-card rounded-lg p-6">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Real cash you could actually be asked to pay out</div>
        <div className="av2-mono mt-1 text-[44px] font-semibold leading-none text-[#e5e2e3]">KSh {fmt(realOwed)}</div>
        <div className="mt-2 text-[13px] text-[#8c909f]">Withdrawable balances held by funded, active players — the true obligation.</div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Bento label="Gross wallet balance (active)" value={`KSh ${fmt(gross)}`} sub="everything, before context" />
        <Bento label="Promo locked (play-only)" value={`KSh ${fmt(promoLockedTotal)}`} sub="can't be withdrawn — marketing" muted />
        <Bento label="Held by never-deposited accounts" value={`KSh ${fmt(unfundedFrozen)}`} sub="internal credit, not real money owed" muted />
        <Bento label="Held by suspended / test" value={`KSh ${fmt(excludedBalance)}`} sub="frozen — not an obligation" muted />
      </div>

      <div className="mb-6 rounded-lg border border-[#27272a] bg-[#161618] p-4 text-[13px] text-[#c2c6d6]">
        <b className="text-[#e5e2e3]">Why the headline looks scary but isn&apos;t.</b> The cockpit shows gross balance
        (KSh {fmt(gross)}). But a chunk is <b>play-only promo</b> that can never leave the platform,
        and more sits in <b>accounts that never deposited real money</b> — that&apos;s credit you issued, not
        cash you received. The number that actually matters is <b className="text-[#e5e2e3]">real cash owed: KSh {fmt(realOwed)}</b>.
      </div>

      <div className="av2-card overflow-hidden rounded-lg">
        <div className="flex items-baseline justify-between border-b border-[#27272a] px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Top 25 balances (concentration)</span>
          <span className="av2-mono text-[12px] text-[#8c909f]">top 25 hold {topShare.toFixed(0)}% of gross</span>
        </div>
        <div className="overflow-x-auto">
          <table className="av2-mono w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#27272a] bg-[#161618] text-[11px] uppercase tracking-wider text-[#c2c6d6]">
                <th className="px-4 py-3">Player</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3">Deposited real money?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {top.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-[#8c909f]">No active balances.</td></tr>}
              {top.map((u) => (
                <tr key={u.id} className="hover:bg-[#1c1b1c]">
                  <td className="px-4 py-2 text-[#e5e2e3]">{u.username ?? u.id.slice(0, 8)}</td>
                  <td className="px-4 py-2 text-right text-[#e5e2e3]">KSh {fmt(Number(u.walletBalance))}</td>
                  <td className="px-4 py-2">{fundedIds.has(u.id) ? <span className="text-[#7ee787]">yes</span> : <span className="text-[#ffb786]">no — promo/credit only</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Bento({ label, value, sub, muted }: { label: string; value: string; sub?: string; muted?: boolean }) {
  return (
    <div className="av2-card relative flex h-28 flex-col justify-between overflow-hidden rounded-lg p-4">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">{label}</span>
      <div>
        <div className={`av2-mono text-[22px] font-semibold ${muted ? "text-[#c2c6d6]" : "text-[#e5e2e3]"}`}>{value}</div>
        {sub && <div className="text-[11px] text-[#8c909f]">{sub}</div>}
      </div>
    </div>
  );
}
