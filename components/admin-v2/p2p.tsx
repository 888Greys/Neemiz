"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { KycRequestsTab, DisputesTab, DepositsTab, CryptoWalletsTab } from "@/components/admin-p2p-client";
import { AdminV2GrantCoin } from "@/components/admin-v2/grant-coin";

// P2P Ops, restyled to the Stitch layout: header + bento metric cards + tab bar.
// The four tab bodies are the existing, fully-wired components (KYC, disputes,
// deposits, crypto wallets) — their tables are recoloured by the .admin-v2
// theme bridge. Real pending counts drive the metric cards + tab pills.

type Tab = "kyc" | "disputes" | "deposits" | "wallets" | "coins";
interface Counts { kyc: number; disputes: number; deposits: number }

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "kyc", label: "KYC Requests", icon: "verified_user" },
  { id: "disputes", label: "Disputes", icon: "gavel" },
  { id: "deposits", label: "Deposits", icon: "south_america" },
  { id: "wallets", label: "Crypto Addresses", icon: "account_balance_wallet" },
  { id: "coins", label: "Grant Coin", icon: "toll" },
];

function Bento({ label, value, icon, tone, note }: { label: string; value: number; icon: string; tone: string; note: string }) {
  return (
    <div className="av2-card group relative flex h-32 cursor-pointer flex-col justify-between overflow-hidden rounded-lg p-4 transition-colors hover:bg-[#1c1c1e]">
      <div className="z-10 flex items-start justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">{label}</span>
        <Icon name={icon} size={20} className={tone} />
      </div>
      <div className="z-10">
        <span className="av2-mono text-[32px] font-semibold text-[#e5e2e3]">{value}</span>
        <div className="mt-1 text-[13px] text-[#c2c6d6]">{note}</div>
      </div>
      <div className="absolute -bottom-4 -right-4 opacity-5 transition-opacity group-hover:opacity-10">
        <Icon name={icon} size={100} />
      </div>
    </div>
  );
}

export function AdminV2P2P() {
  const [tab, setTab] = useState<Tab>("kyc");
  const [counts, setCounts] = useState<Counts>({ kyc: 0, disputes: 0, deposits: 0 });

  const fetchCounts = useCallback(async () => {
    try {
      const [kycRes, dRes, depRes] = await Promise.all([
        fetch("/api/admin/p2p/merchants?status=PENDING"),
        fetch("/api/admin/p2p/disputes?status=OPEN"),
        fetch("/api/admin/p2p/deposits?status=PENDING"),
      ]);
      const [kyc, disputes, deposits] = await Promise.all([
        kycRes.ok ? kycRes.json() : [],
        dRes.ok ? dRes.json() : [],
        depRes.ok ? depRes.json() : [],
      ]);
      setCounts({
        kyc: Array.isArray(kyc) ? kyc.length : 0,
        disputes: Array.isArray(disputes) ? disputes.length : 0,
        deposits: Array.isArray(deposits) ? deposits.length : 0,
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const pill = (n: number) => (n > 0 ? (n > 99 ? "99+" : String(n)) : null);

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="mb-1 text-[32px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">P2P Operations</h2>
          <p className="text-[14px] text-[#c2c6d6]">Manage merchant onboarding, disputes, and peer-to-peer liquidity.</p>
        </div>
      </div>

      {/* Bento metrics */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Bento label="Pending KYC Reviews" value={counts.kyc} icon="pending" tone="text-[#adc6ff]" note="Merchant verifications" />
        <Bento label="Open Disputes" value={counts.disputes} icon="gavel" tone="text-[#ffb786]" note="Buyer / seller conflicts" />
        <Bento label="Pending Deposits" value={counts.deposits} icon="south_america" tone={counts.deposits > 0 ? "text-red-400" : "text-[#c2c6d6]"} note="Crypto merchant top-ups" />
      </div>

      {/* Tabs */}
      <div className="mb-6 flex max-w-full overflow-x-auto border-b border-[#424754]">
        {TABS.map((t) => {
          const count = t.id === "kyc" ? counts.kyc : t.id === "disputes" ? counts.disputes : t.id === "deposits" ? counts.deposits : 0;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-[16px] font-semibold transition-colors ${
                active ? "border-[#adc6ff] bg-[#1c1b1c] text-[#adc6ff]" : "border-transparent text-[#c2c6d6] hover:bg-[#0e0e0f] hover:text-[#e5e2e3]"
              }`}
            >
              <Icon name={t.icon} size={18} />
              {t.label}
              {pill(count) && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-[#adc6ff]/20 text-[#adc6ff]" : "bg-[#2a2a2b] text-[#c2c6d6]"}`}>{pill(count)}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content (existing wired components, recoloured by the theme bridge) */}
      {tab === "kyc" && <KycRequestsTab onAction={fetchCounts} />}
      {tab === "disputes" && <DisputesTab onAction={fetchCounts} />}
      {tab === "deposits" && <DepositsTab onAction={fetchCounts} />}
      {tab === "wallets" && <CryptoWalletsTab />}
      {tab === "coins" && <AdminV2GrantCoin />}
    </div>
  );
}
