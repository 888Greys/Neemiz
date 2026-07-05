"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { createClient } from "@/lib/supabase/client";
import { DEV_FAST } from "@/lib/dev-fast";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";

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
  link?: string | null;
  source: "tx" | "db";
  rawDate: number;
}

const TX_META: Record<string, { badge: string; badgeColor: string; icon: string; sign: "+" | "-" }> = {
  DEPOSIT:    { badge: "DEPOSIT",    badgeColor: "bg-emerald-500/15 text-emerald-400", icon: "add_circle",    sign: "+" },
  WITHDRAWAL: { badge: "WITHDRAW",   badgeColor: "bg-red-500/15 text-red-400",         icon: "remove_circle", sign: "-" },
  BET_STAKE:  { badge: "BET",        badgeColor: "bg-[#087cff]/15 text-[#087cff]",     icon: "sports_soccer", sign: "-" },
  BET_WIN:    { badge: "WIN",        badgeColor: "bg-emerald-500/15 text-emerald-400", icon: "emoji_events",  sign: "+" },
  BONUS:      { badge: "BONUS",      badgeColor: "bg-amber-400/15 text-amber-400",     icon: "redeem",        sign: "+" },
  REFUND:     { badge: "REFUND",     badgeColor: "bg-sky-400/15 text-sky-400",         icon: "undo",          sign: "+" },
};

const DB_NOTIF_META: Record<string, { badge: string; badgeColor: string }> = {
  wallet_transfer_sent:     { badge: "SENT",     badgeColor: "bg-sky-500/15 text-sky-400" },
  wallet_transfer_received: { badge: "RECEIVED", badgeColor: "bg-emerald-500/15 text-emerald-400" },
  p2p_paid:      { badge: "P2P",       badgeColor: "bg-[#087cff]/15 text-[#087cff]" },
  p2p_message:   { badge: "MESSAGE",   badgeColor: "bg-sky-500/15 text-sky-400" },
  p2p_released:  { badge: "RELEASED",  badgeColor: "bg-[#31c45d]/15 text-[#31c45d]" },
  p2p_dispute:   { badge: "DISPUTE",   badgeColor: "bg-red-500/15 text-red-400" },
  p2p_cancelled: { badge: "CANCELLED", badgeColor: "bg-slate-500/15 text-slate-400" },
  kyc_approved:  { badge: "KYC ✓",    badgeColor: "bg-[#31c45d]/15 text-[#31c45d]" },
  kyc_rejected:  { badge: "KYC ✗",    badgeColor: "bg-red-500/15 text-red-400" },
  polymarket_comment: { badge: "COMMENT", badgeColor: "bg-violet-500/15 text-violet-300" },
  withdraw_reopen:    { badge: "ALERT",   badgeColor: "bg-amber-400/15 text-amber-400" },
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
  const amt  = `${CURRENCY_SYMBOL} ${Number(tx.amount).toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2 })}`;

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
    source:     "tx",
    rawDate:    new Date(tx.createdAt).getTime(),
  };
}

interface DbNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

function dbToNotification(n: DbNotification): Notification {
  const meta = DB_NOTIF_META[n.type] ?? { badge: n.type.toUpperCase(), badgeColor: "bg-white/10 text-slate-400" };
  const isP2P = n.type.startsWith("p2p_");
  const isKyc = n.type.startsWith("kyc_");

  return {
    id:         n.id,
    type:       isP2P || isKyc ? "personal" : "system",
    title:      n.title,
    body:       n.body,
    time:       timeAgo(n.createdAt),
    read:       n.isRead,
    badge:      meta.badge,
    badgeColor: meta.badgeColor,
    link:       n.link,
    source:     "db",
    rawDate:    new Date(n.createdAt).getTime(),
  };
}

const LAST_READ_KEY = "nezeem_notif_last_read";
const NOTIFICATION_CACHE_MS = 60_000;
const NOTIFICATION_POLL_MS = 60_000;
export const NOTIFICATIONS_REFRESH_EVENT = "nezeem:notifications-refresh";
let notificationCache: { notes: Notification[]; fetchedAt: number } | null = null;
let notificationRequest: Promise<Notification[]> | null = null;
let notificationUserId: string | null = null;

async function fetchNotifications(force = false): Promise<Notification[]> {
  if (DEV_FAST) {
    notificationCache = { notes: [], fetchedAt: Date.now() };
    return [];
  }
  if (force) notificationCache = null;
  if (notificationRequest) return notificationRequest;

  notificationRequest = fetch("/api/notifications")
  .then(async (response) => response.ok ? response.json() : { notifications: [], transactions: [] })
  .then((data: { userId?: string; notifications?: DbNotification[]; transactions?: Array<{ id: string; type: string; amount: number; status: string; createdAt: string }> }) => {
    notificationUserId = data.userId ?? notificationUserId;
    const txNotes = Array.isArray(data.transactions) ? data.transactions.map(txToNotification) : [];
    const dbNotes = Array.isArray(data.notifications) ? data.notifications.map(dbToNotification) : [];
    const notes = [...txNotes, ...dbNotes].sort((a, b) => b.rawDate - a.rawDate);
    notificationCache = { notes, fetchedAt: Date.now() };
    return notes;
  }).finally(() => {
    notificationRequest = null;
  });

  return notificationRequest;
}

// Single source of truth for "is this notification unread", shared by the bell
// badge and the dropdown header pill so the two counts never disagree.
// - DB notifications: unread iff isRead === false.
// - Transactions: only PENDING ones can be unread, and only if they arrived
//   after the user's last "mark all read" (older pending tx are considered seen).
function noteUnread(n: Notification, lastRead: number): boolean {
  if (n.source === "tx") return !n.read && n.rawDate > lastRead;
  return !n.read;
}

function readLastRead(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(LAST_READ_KEY) ?? 0);
}

type Props = { onClose: () => void };

export function NotificationsDropdown({ onClose }: Props) {
  const [tab, setTab]         = useState<Tab>("all");
  const [notes, setNotes]     = useState<Notification[]>(() => notificationCache?.notes ?? []);
  const [loading, setLoading] = useState(() => !notificationCache);
  const ref                   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const loadNotifications = useCallback(async () => {
    const hasCachedNotes = !!notificationCache;
    if (!hasCachedNotes) setLoading(true);
    try {
      setNotes(await fetchNotifications());
    } catch {
      if (!hasCachedNotes) setNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const filtered = notes.filter((n) => {
    if (tab === "personal") return n.type === "personal";
    if (tab === "general")  return n.type === "promo" || n.type === "system";
    return true;
  });

  const lastRead = readLastRead();
  const unread = notes.filter((n) => noteUnread(n, lastRead)).length;

  async function markAllRead() {
    localStorage.setItem(LAST_READ_KEY, String(Date.now()));
    setNotes((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      notificationCache = { notes: next, fetchedAt: Date.now() };
      return next;
    });
    try {
      await fetch("/api/notifications", { method: "PATCH" });
    } catch { /* ignore */ }
  }

  function markRead(id: string) {
    setNotes((prev) => {
      const next = prev.map((n) => n.id === id ? { ...n, read: true } : n);
      notificationCache = { notes: next, fetchedAt: Date.now() };
      return next;
    });
  }

  return (
    <div
      ref={ref}
      className="fixed right-3 top-14 z-[500] w-[calc(100vw-1.5rem)] max-w-[340px] overflow-hidden rounded-2xl bg-[#111316] shadow-[0_8px_48px_rgba(0,0,0,0.7)] ring-1 ring-white/[0.09] animate-in fade-in slide-in-from-top-2 duration-200 sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-[340px]"
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
          filtered.map((n, i) => {
            const un = noteUnread(n, lastRead);
            const inner = (
              <div
                className={`relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03] ${
                  un ? "bg-[#087cff]/[0.04]" : ""
                }`}
              >
                {un && (
                  <span className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#087cff]" />
                )}
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${un ? "bg-[#087cff]/15" : "bg-white/[0.05]"}`}>
                  <Icon
                    name={n.type === "personal" ? "person" : n.type === "system" ? "info" : "campaign"}
                    fill
                    className={`text-[17px] ${un ? "text-[#087cff]" : "text-slate-500"}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${n.badgeColor}`}>
                      {n.badge}
                    </span>
                    <span className="ml-auto text-[10px] text-slate-600">{n.time}</span>
                  </div>
                  <p className={`text-[12px] font-black leading-snug ${un ? "text-white" : "text-slate-300"}`}>
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500 line-clamp-2">{n.body}</p>
                </div>
              </div>
            );

            return (
              <div key={n.id}>
                {n.link ? (
                  <Link href={n.link} onClick={() => markRead(n.id)} className="block w-full">
                    {inner}
                  </Link>
                ) : (
                  <button type="button" onClick={() => markRead(n.id)} className="w-full">
                    {inner}
                  </button>
                )}
                {i < filtered.length - 1 && <div className="mx-4 h-px bg-white/[0.04]" />}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.07] px-4 py-3 text-center">
        <p className="text-[11px] text-slate-600">Showing your recent notifications</p>
      </div>
    </div>
  );
}

/* ── Bell button with badge — used in header ── */
export function NotificationsBell() {
  const [open, setOpen]     = useState(false);
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const lastRead = Number(localStorage.getItem(LAST_READ_KEY) ?? 0);
      const cacheFresh = notificationCache && Date.now() - notificationCache.fetchedAt < NOTIFICATION_CACHE_MS;
      const notes = cacheFresh ? notificationCache!.notes : await fetchNotifications();
      setUnread(notes.filter((note) => noteUnread(note, lastRead)).length);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (DEV_FAST) return;
    let disposed = false;
    let realtimeChannel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    const supabase = createClient();
    const refreshNow = () => {
      notificationCache = null;
      refreshUnread();
    };
    const refreshVisible = () => {
      if (document.visibilityState === "visible") refreshNow();
    };
    void refreshUnread().then(() => {
      if (disposed || !notificationUserId) return;
      realtimeChannel = supabase
        .channel(`notifications:${notificationUserId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${notificationUserId}`,
          },
          refreshNow,
        )
        .subscribe();
    });
    const timer = window.setInterval(refreshVisible, NOTIFICATION_POLL_MS);
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, refreshNow);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, refreshNow);
      document.removeEventListener("visibilitychange", refreshVisible);
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, [refreshUnread]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          notificationCache = null;
          refreshUnread();
        }}
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
