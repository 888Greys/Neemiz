"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";

type Tab = "all" | "personal" | "general";

interface Notification {
  id: string;
  type: "personal" | "system" | "promo";
  title: string;
  body: string;
  time: string;
  read: boolean;
  badge: string;
  badgeColor: string;
}

const TX_META: Record<string, { badge: string; badgeColor: string; icon: string; sign: "+" | "-" }> = {
  DEPOSIT:    { badge: "DEPOSIT",    badgeColor: "bg-emerald-500/15 text-emerald-400", icon: "add_circle",    sign: "+" },
  WITHDRAWAL: { badge: "WITHDRAW",   badgeColor: "bg-red-500/15 text-red-400",         icon: "remove_circle", sign: "-" },
  BET_STAKE:  { badge: "BET",        badgeColor: "bg-[#087cff]/15 text-[#087cff]",     icon: "sports_soccer", sign: "-" },
  BET_WIN:    { badge: "WIN",        badgeColor: "bg-emerald-500/15 text-emerald-400", icon: "emoji_events",  sign: "+" },
  BONUS:      { badge: "BONUS",      badgeColor: "bg-amber-400/15 text-amber-400",     icon: "redeem",        sign: "+" },
  REFUND:     { badge: "REFUND",     badgeColor: "bg-sky-400/15 text-sky-400",         icon: "undo",          sign: "+" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function txToNotification(tx: { id: string; type: string; amount: number; status: string; createdAt: string }): Notification {
  const meta = TX_META[tx.type] ?? { badge: tx.type, badgeColor: "bg-white/10 text-slate-400", icon: "swap_horiz", sign: "+" as const };
  const amt  = `KSh ${Number(tx.amount).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

  let title = "";
  let body  = "";

  if (tx.type === "DEPOSIT") {
    if (tx.status === "COMPLETED") {
      title = `${meta.sign}${amt} Deposit confirmed`;
      body  = "Your M-Pesa deposit has been credited to your wallet.";
    } else if (tx.status === "PENDING") {
      title = `Deposit of ${amt} pending`;
      body  = "Waiting for M-Pesa confirmation.";
    } else {
      title = `Deposit of ${amt} failed`;
      body  = "Your M-Pesa deposit could not be processed.";
    }
  } else if (tx.type === "WITHDRAWAL") {
    title = `${meta.sign}${amt} Withdrawal`;
    body  = tx.status === "COMPLETED" ? "Sent to your M-Pesa." : `Status: ${tx.status}`;
  } else if (tx.type === "BET_STAKE") {
    title = `Bet placed — ${amt}`;
    body  = "Your bet has been placed successfully.";
  } else if (tx.type === "BET_WIN") {
    title = `You won ${amt}!`;
    body  = "Winnings have been credited to your wallet.";
  } else if (tx.type === "BONUS") {
    title = `Bonus of ${amt} credited`;
    body  = "A bonus has been added to your wallet.";
  } else if (tx.type === "REFUND") {
    title = `Refund of ${amt}`;
    body  = "A refund has been credited to your wallet.";
  } else {
    title = `${tx.type} — ${amt}`;
    body  = `Status: ${tx.status}`;
  }

  return {
    id:         tx.id,
    type:       "personal",
    title,
    body,
    time:       timeAgo(tx.createdAt),
    read:       tx.status !== "PENDING",
    badge:      meta.badge,
    badgeColor: meta.badgeColor,
  };
}

type Props = { onClose: () => void };

export function NotificationsDropdown({ onClose }: Props) {
  const [tab, setTab]       = useState<Tab>("all");
  const [notes, setNotes]   = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const ref                 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    setLoading(true);
    fetch("/api/wallet/transactions")
      .then((r) => r.ok ? r.json() : [])
      .then((txns: { id: string; type: string; amount: number; status: string; createdAt: string }[]) => {
        setNotes(Array.isArray(txns) ? txns.map(txToNotification) : []);
      })
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = notes.filter((n) => {
    if (tab === "personal") return n.type === "personal";
    if (tab === "general")  return n.type === "promo" || n.type === "system";
    return true;
  });

  const unread = notes.filter((n) => !n.read).length;

  function markAllRead() {
    setNotes((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function markRead(id: string) {
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-[300] mt-2 w-[340px] overflow-hidden rounded-2xl bg-[#111316] shadow-[0_8px_48px_rgba(0,0,0,0.7)] ring-1 ring-white/[0.09] animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-black text-white">Notifications</h3>
          {unread > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#087cff] px-1.5 text-[10px] font-black text-white">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button type="button" onClick={markAllRead} className="text-[11px] font-black text-[#087cff] transition hover:text-blue-400">
              Mark all read
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <Icon name="close" className="text-[15px]" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.07] px-3 pt-2 pb-0">
        {(["all", "personal", "general"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 pb-2.5 text-[12px] font-black uppercase tracking-wide transition ${
              tab === t ? "border-b-2 border-[#087cff] text-[#087cff]" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="no-scrollbar max-h-[380px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="h-5 w-5 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Icon name="notifications_off" fill className="text-[32px] text-slate-700" />
            <p className="text-sm font-black text-white">No activity yet</p>
            <p className="text-xs text-slate-600">Deposits, bets and wins will appear here</p>
          </div>
        ) : (
          filtered.map((n, i) => (
            <div key={n.id}>
              <button
                type="button"
                onClick={() => markRead(n.id)}
                className={`relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03] ${
                  !n.read ? "bg-[#087cff]/[0.04]" : ""
                }`}
              >
                {!n.read && (
                  <span className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#087cff]" />
                )}
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${!n.read ? "bg-[#087cff]/15" : "bg-white/[0.05]"}`}>
                  <Icon
                    name={n.type === "personal" ? "person" : n.type === "system" ? "info" : "campaign"}
                    fill
                    className={`text-[17px] ${!n.read ? "text-[#087cff]" : "text-slate-500"}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${n.badgeColor}`}>
                      {n.badge}
                    </span>
                    <span className="ml-auto text-[10px] text-slate-600">{n.time}</span>
                  </div>
                  <p className={`text-[12px] font-black leading-snug ${!n.read ? "text-white" : "text-slate-300"}`}>
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500 line-clamp-2">{n.body}</p>
                </div>
              </button>
              {i < filtered.length - 1 && <div className="mx-4 h-px bg-white/[0.04]" />}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.07] px-4 py-3 text-center">
        <p className="text-[11px] text-slate-600">Showing your last 20 transactions</p>
      </div>
    </div>
  );
}

/* ── Bell button with badge — used in header ── */
export function NotificationsBell() {
  const [open, setOpen]   = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch("/api/wallet/transactions")
      .then((r) => r.ok ? r.json() : [])
      .then((txns: { status: string }[]) => {
        if (Array.isArray(txns)) {
          setUnread(txns.filter((t) => t.status === "PENDING").length);
        }
      })
      .catch(() => {});
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition ${
          open ? "bg-[#087cff]/20 text-[#087cff]" : "bg-white/[0.06] text-slate-400 hover:bg-white/[0.10] hover:text-white"
        }`}
        aria-label="Notifications"
      >
        <Icon name="notifications" fill={open} className="text-[20px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ff1979] px-1 text-[9px] font-black text-white ring-2 ring-[#111113]">
            {unread}
          </span>
        )}
      </button>
      {open && <NotificationsDropdown onClose={() => setOpen(false)} />}
    </div>
  );
}
