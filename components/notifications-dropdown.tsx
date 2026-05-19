"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";

type Tab = "all" | "personal" | "general";

interface Notification {
  id: string;
  type: "promo" | "personal" | "system";
  title: string;
  body: string;
  time: string;
  read: boolean;
  image?: string;
  badge?: string;
  badgeColor?: string;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    type: "promo",
    title: "🎁 Free Bet — KSh 500",
    body: "Deposit KSh 1,000 today and get a free bet worth KSh 500. Valid 24 hours.",
    time: "Just now",
    read: false,
    badge: "BONUS",
    badgeColor: "bg-amber-400/15 text-amber-400",
  },
  {
    id: "2",
    type: "promo",
    title: "⚽ Enhanced Odds — Premier League",
    body: "Man City vs Arsenal boosted to 3.50. Limited time offer for all users.",
    time: "2 min ago",
    read: false,
    badge: "SPORTS",
    badgeColor: "bg-[#087cff]/15 text-[#087cff]",
  },
  {
    id: "3",
    type: "system",
    title: "✅ Account Verified",
    body: "Your email has been verified. You now have full access to all features.",
    time: "1 hr ago",
    read: true,
    badge: "SYSTEM",
    badgeColor: "bg-emerald-500/15 text-emerald-400",
  },
  {
    id: "4",
    type: "promo",
    title: "🚀 Aviator — 2× Multiplier Streak",
    body: "We noticed you love Aviator! Cash out before the plane flies away.",
    time: "3 hr ago",
    read: true,
    badge: "CASINO",
    badgeColor: "bg-[#ff1979]/15 text-[#ff1979]",
  },
  {
    id: "5",
    type: "personal",
    title: "💰 Deposit Confirmed",
    body: "Your deposit of KSh 1,000 has been received and credited to your wallet.",
    time: "Yesterday",
    read: true,
    badge: "WALLET",
    badgeColor: "bg-emerald-500/15 text-emerald-400",
  },
];

type Props = {
  onClose: () => void;
};

export function NotificationsDropdown({ onClose }: Props) {
  const [tab, setTab]    = useState<Tab>("all");
  const [notes, setNotes] = useState(MOCK_NOTIFICATIONS);
  const ref              = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filtered = notes.filter((n) => {
    if (tab === "all")      return true;
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
            <button
              type="button"
              onClick={markAllRead}
              className="text-[11px] font-black text-[#087cff] transition hover:text-blue-400"
            >
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
              tab === t
                ? "border-b-2 border-[#087cff] text-[#087cff]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="no-scrollbar max-h-[380px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Icon name="notifications_off" fill className="text-[32px] text-slate-700" />
            <p className="text-sm font-black text-white">No notifications</p>
            <p className="text-xs text-slate-600">You&apos;re all caught up!</p>
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
                {/* Unread dot */}
                {!n.read && (
                  <span className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#087cff]" />
                )}
                {/* Icon */}
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${!n.read ? "bg-[#087cff]/15" : "bg-white/[0.05]"}`}>
                  <Icon
                    name={
                      n.type === "personal" ? "person"
                      : n.type === "system"  ? "info"
                      : "campaign"
                    }
                    fill
                    className={`text-[17px] ${!n.read ? "text-[#087cff]" : "text-slate-500"}`}
                  />
                </div>
                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    {n.badge && (
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${n.badgeColor}`}>
                        {n.badge}
                      </span>
                    )}
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
        <button
          type="button"
          onClick={() => toast.info("Coming soon", "A full notifications centre is on the way!")}
          className="text-[12px] font-black text-slate-500 transition hover:text-white"
        >
          View all notifications
        </button>
      </div>
    </div>
  );
}

/* ── Bell button with badge — used in header ── */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const UNREAD = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;

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
        {UNREAD > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ff1979] px-1 text-[9px] font-black text-white ring-2 ring-[#111113]">
            {UNREAD}
          </span>
        )}
      </button>
      {open && <NotificationsDropdown onClose={() => setOpen(false)} />}
    </div>
  );
}
