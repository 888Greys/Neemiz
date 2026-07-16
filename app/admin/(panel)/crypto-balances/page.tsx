import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { db } from "@/lib/db";

export const metadata = { title: "Crypto Balances · Nezeem" };
export const dynamic = "force-dynamic";

// Owner-admin diagnostic: system-wide crypto ledger. Sums every UserCryptoBalance
// row by coin (available + locked) — i.e. how much of each coin the platform owes
// its users — plus the KES Coin total, which is backed by User.walletBalance.

const fmt = (n: number) =>
  n.toLocaleString("en-KE", { maximumFractionDigits: 8 });

export default async function AdminCryptoBalancesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = user?.email ?? "";

  const [balances, kesAgg] = await Promise.all([
    db.userCryptoBalance.groupBy({
      by: ["crypto"],
      _sum: { available: true, locked: true },
      _count: { _all: true },
    }),
    db.user.aggregate({ _sum: { walletBalance: true } }),
  ]);

  const coins = balances
    .map((b) => {
      const available = Number(b._sum.available ?? 0);
      const locked = Number(b._sum.locked ?? 0);
      return {
        crypto: b.crypto.toUpperCase(),
        available,
        locked,
        total: available + locked,
        holders: b._count._all,
      };
    })
    .filter((c) => c.total !== 0)
    .sort((a, b) => b.total - a.total);

  const kesTotal = Number(kesAgg._sum.walletBalance ?? 0);
  coins.push({ crypto: "KES", available: kesTotal, locked: 0, total: kesTotal, holders: 0 });

  return (
    <AdminShell adminEmail={adminEmail}>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-1 text-xl font-black">Crypto Balances</h1>
        <p className="mb-5 text-sm text-white/60">
          System-wide crypto held on-platform, per coin. Total = available + locked
          across all users. KES is the fiat-backed KES Coin wallet.
        </p>

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Distinct coins" value={String(coins.length)} />
          <Stat
            label="Total locked positions"
            value={fmt(coins.reduce((s, c) => s + c.locked, 0))}
          />
          <Stat label="KES Coin total" value={`KSh ${fmt(kesTotal)}`} />
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-white/60">
              <tr>
                <Th>Coin</Th>
                <Th>Available</Th>
                <Th>Locked</Th>
                <Th>Total</Th>
                <Th>Holders</Th>
              </tr>
            </thead>
            <tbody>
              {coins.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-white/50">No crypto balances on the system.</td></tr>
              )}
              {coins.map((c) => (
                <tr key={c.crypto} className="border-t border-white/10">
                  <Td className="font-bold">{c.crypto}</Td>
                  <Td>{fmt(c.available)}</Td>
                  <Td>{fmt(c.locked)}</Td>
                  <Td className="font-bold">{fmt(c.total)}</Td>
                  <Td>{c.holders || "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] uppercase tracking-wide text-white/50">{label}</div>
      <div className="mt-1 text-base font-black text-white">{value}</div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide">{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
