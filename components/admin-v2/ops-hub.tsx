"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminV2Ops } from "./ops";
import { AdminV2Withdrawals } from "./withdrawals";
import { AdminV2P2P } from "./p2p";
import { AdminV2Broadcast } from "./broadcast";
import { LipaRecovery } from "./lipa-recovery";

// One Ops page, tabbed over the existing action components (reused as-is so every
// mutation keeps working): overview, withdrawal approvals, P2P ops, broadcast.
// Tab is URL-backed (?tab=) so Action Queue links can deep-link into a queue.
const TABS: { id: string; label: string; C: React.ComponentType }[] = [
  { id: "overview", label: "Overview", C: AdminV2Ops },
  { id: "withdrawals", label: "Withdrawals", C: AdminV2Withdrawals },
  { id: "p2p", label: "P2P ops", C: AdminV2P2P },
  { id: "broadcast", label: "Broadcast", C: AdminV2Broadcast },
  { id: "recovery", label: "Lipa recovery", C: LipaRecovery },
];

const TAB_IDS = new Set(TABS.map((t) => t.id));

export function OpsHub() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab") ?? "overview";
  const tab = TAB_IDS.has(raw) ? raw : "overview";
  const Active = (TABS.find((t) => t.id === tab) ?? TABS[0]).C;

  const setTab = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id === "overview") params.delete("tab");
      else params.set("tab", id);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#adc6ff]">Operations</p>
        <h2 className="mt-1 text-[28px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">Ops</h2>
      </div>
      <div className="mb-5 flex gap-1.5 border-b border-[#27272a]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] font-semibold transition ${
              tab === t.id ? "border-[#adc6ff] text-[#e5e2e3]" : "border-transparent text-[#8c909f] hover:text-[#c2c6d6]"
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
