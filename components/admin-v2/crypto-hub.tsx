"use client";

import { useState } from "react";
import { AdminV2Crypto } from "./crypto";
import { AdminV2CryptoBalances } from "./crypto-balances";

// Crypto treasury, folded into the Money page as one tab: on-chain exposure
// (live per-address balances) and system-wide held balances. Both components
// self-fetch, so they're reused as-is.
const SUBTABS: { id: string; label: string; C: React.ComponentType }[] = [
  { id: "exposure", label: "On-chain exposure", C: AdminV2Crypto },
  { id: "balances", label: "System balances", C: AdminV2CryptoBalances },
];

export function CryptoHub() {
  const [tab, setTab] = useState("exposure");
  const Active = (SUBTABS.find((t) => t.id === tab) ?? SUBTABS[0]).C;
  return (
    <div>
      <div className="mb-5 flex gap-1.5">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-2 text-[12px] font-semibold transition ${
              tab === t.id ? "bg-[#3a4a5f] text-[#adc6ff]" : "bg-[#161618] text-[#c2c6d6] hover:text-[#e5e2e3]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Active />
    </div>
  );
}
