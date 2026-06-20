"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";

type Level = "info" | "warning" | "maintenance" | "success";

interface Broadcast {
  id: string;
  title: string;
  message: string;
  level: Level;
}

const STYLES: Record<Level, { color: string; icon: string }> = {
  info:        { color: "#087cff", icon: "info" },
  success:     { color: "#05b957", icon: "campaign" },
  warning:     { color: "#f59e0b", icon: "warning" },
  maintenance: { color: "#ef4444", icon: "settings" },
};

const DISMISS_KEY = "dismissed-broadcasts";

function getDismissed(): string[] {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]"); }
  catch { return []; }
}

/**
 * Site-wide announcement banner. Fetches active broadcasts and renders the most
 * recent one the user hasn't dismissed. Dismissals persist per-broadcast id.
 */
export function BroadcastBanner() {
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/broadcast", { cache: "no-store" });
        if (!res.ok) return;
        const list: Broadcast[] = await res.json();
        if (cancelled || list.length === 0) return;
        const dismissed = getDismissed();
        const next = list.find((b) => !dismissed.includes(b.id));
        if (next) setBroadcast(next);
      } catch {
        /* banner is best-effort — ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!broadcast) return null;

  const style = STYLES[broadcast.level] ?? STYLES.info;

  function dismiss() {
    if (!broadcast) return;
    try {
      const dismissed = getDismissed();
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed, broadcast.id].slice(-50)));
    } catch { /* ignore */ }
    setBroadcast(null);
  }

  return (
    <div
      className="relative flex items-start gap-2.5 px-3 py-2 lg:px-6"
      style={{ backgroundColor: `${style.color}1f`, boxShadow: `inset 0 -1px 0 ${style.color}40` }}
      role="status"
    >
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md" style={{ color: style.color }}>
        <Icon name={style.icon} fill className="text-[16px]" />
      </span>
      <div className="min-w-0 flex-1 pr-6">
        <span className="text-[12px] font-black text-white">{broadcast.title}</span>
        <span className="ml-2 text-[12px] text-slate-200">{broadcast.message}</span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-1.5 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
      >
        <Icon name="close" className="text-[15px]" />
      </button>
    </div>
  );
}
