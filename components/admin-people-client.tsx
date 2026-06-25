"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PlayersClient } from "@/components/admin-players-client";
import { AdminUsersClient } from "@/components/admin-users-client";
import { Icon } from "@/components/icon";

// Unified "Players" surface. The redesigned growth/acquisition screen and the
// operational user directory used to be two separate nav items (Players vs
// Users) that confused the owner; they are now two tabs of one page.
type Tab = "overview" | "directory";

export function AdminPeopleClient() {
  const initial = useSearchParams().get("tab") === "directory" ? "directory" : "overview";
  const [tab, setTab] = useState<Tab>(initial);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "insights" },
    { id: "directory", label: "Directory", icon: "groups" },
  ];

  return (
    <div>
      <div className="admin-page pb-0">
        <div className="flex gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-black transition ${tab === t.id ? "bg-[#087cff] text-white" : "text-slate-500 hover:text-slate-300"}`}
            >
              <Icon name={t.icon} size={13} /> {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "overview" ? <PlayersClient /> : <AdminUsersClient />}
    </div>
  );
}
