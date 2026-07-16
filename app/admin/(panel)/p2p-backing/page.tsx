import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { db } from "@/lib/db";
import { kesLockAmount, defaultNetwork, isKesCoin } from "@/lib/p2p/crypto-balance";
import { isActiveLocalCoin } from "@/lib/p2p/local-coins";
import { convertToKes } from "@/lib/currency-config";
import { getFxRatesToKES } from "@/lib/p2p/fx";

export const metadata = { title: "P2P Backing · Nezeem" };
export const dynamic = "force-dynamic";

// Owner-admin diagnostic: reproduces the EXACT backing check that gates
// local-coin SELL ad creation (lib/p2p/ad-backing.ts → assertLocalCoinSellBacking)
// so we can see, per ad, how much free KES each active local-coin sell ad
// reserves and whether the wallet can cover the combined total.

const fmt = (n: number) =>
  n.toLocaleString("en-KE", { maximumFractionDigits: 2 });

export default async function AdminP2PBackingPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = user?.email ?? "";

  const sp = await searchParams;
  const email = (sp.email ?? "goodhope229@gmail.com").trim();

  const target = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      username: true,
      walletBalance: true,
      merchantProfile: { select: { id: true, displayName: true } },
    },
  });

  let body: React.ReactNode;

  if (!target) {
    body = <p className="text-red-400">No user found for “{email}”.</p>;
  } else if (!target.merchantProfile) {
    body = <p className="text-yellow-400">{email} has no merchant profile (no P2P ads).</p>;
  } else {
    const walletBalance = Number(target.walletBalance ?? 0);
    const rates = await getFxRatesToKES();

    const ads = await db.p2PAd.findMany({
      where: {
        merchantId: target.merchantProfile.id,
        side: "SELL",
        isActive: true,
        availableAmount: { gt: 0 },
      },
      select: { id: true, crypto: true, availableAmount: true, pricePerUnit: true, fiat: true },
    });

    const cryptoBalances = await db.userCryptoBalance.findMany({
      where: { userId: target.id },
      select: { crypto: true, network: true, available: true },
    });
    const balanceMap = new Map<string, number>();
    for (const cb of cryptoBalances) {
      if (cb.network === defaultNetwork(cb.crypto)) {
        balanceMap.set(cb.crypto.toUpperCase(), Number(cb.available));
      }
    }

    const rows = ads
      .filter((a) => isActiveLocalCoin(a.crypto))
      .map((a) => {
        const sym = a.crypto.toUpperCase();
        const avail = Number(a.availableAmount);
        const need = kesLockAmount(avail);
        const kes = isKesCoin(sym);
        const haveCoin = kes ? 0 : (balanceMap.get(sym) ?? 0);
        const shortfallCoin = kes ? need : Math.max(0, need - haveCoin);
        const rate = kes ? 1 : (rates.toKES[sym] ?? null);
        const kesReserved = kes
          ? need
          : convertToKes(shortfallCoin, sym, rates.toKES);
        return { id: a.id, sym, avail, need, haveCoin, shortfallCoin, rate, kesReserved };
      });

    const totalKesRequired = rows.reduce((s, r) => s + r.kesReserved, 0);
    const covered = walletBalance >= totalKesRequired;

    body = (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="User" value={target.username ?? "—"} />
          <Stat label="Wallet (free KES)" value={`KSh ${fmt(walletBalance)}`} />
          <Stat label="KES required (all active sell ads)" value={`KSh ${fmt(totalKesRequired)}`} />
          <Stat
            label="Can create another?"
            value={covered ? "Yes — headroom" : "NO — over budget"}
            tone={covered ? "ok" : "bad"}
          />
        </div>

        <div>
          <p className="mb-2 text-sm text-white/60">
            FX source: {rates.live ? "live" : "fallback"} · TZS rate ={" "}
            {rates.toKES["TZS"] ?? "n/a"} KES/coin
          </p>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-white/60">
                <tr>
                  <Th>Coin</Th>
                  <Th>Listed</Th>
                  <Th>Need (+1%)</Th>
                  <Th>Coin held</Th>
                  <Th>Shortfall (coin)</Th>
                  <Th>Rate KES/coin</Th>
                  <Th>KES reserved</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="p-4 text-white/50">No active local-coin sell ads.</td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/10">
                    <Td className="font-bold">{r.sym}</Td>
                    <Td>{fmt(r.avail)}</Td>
                    <Td>{fmt(r.need)}</Td>
                    <Td>{fmt(r.haveCoin)}</Td>
                    <Td>{fmt(r.shortfallCoin)}</Td>
                    <Td>{r.rate == null ? "⚠ none" : r.rate}</Td>
                    <Td className="font-bold">KSh {fmt(r.kesReserved)}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-white/20 bg-white/5">
                  <Td className="font-bold" >TOTAL</Td>
                  <Td /><Td /><Td /><Td /><Td />
                  <Td className="font-bold">KSh {fmt(totalKesRequired)}</Td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminShell adminEmail={adminEmail}>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-1 text-xl font-black">P2P Backing Diagnostic</h1>
        <p className="mb-5 text-sm text-white/60">
          Shows how much free KES each active local-coin SELL ad reserves. This is
          the exact check that gates new ad creation.
        </p>

        <form method="get" className="mb-6 flex gap-2">
          <input
            name="email"
            defaultValue={email}
            placeholder="user email"
            className="flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/40"
          />
          <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black">
            Inspect
          </button>
        </form>

        {body}
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  const color = tone === "ok" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] uppercase tracking-wide text-white/50">{label}</div>
      <div className={`mt-1 text-base font-black ${color}`}>{value}</div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide">{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
