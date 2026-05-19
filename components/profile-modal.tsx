"use client";

import { useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";

type View = "main" | "settings";

type Props = {
  onClose: () => void;
  onOpenWallet: () => void;
};

export function ProfileModal({ onClose, onOpenWallet }: Props) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const { balance, currency } = useWalletBalance();
  const [view, setView] = useState<View>("main");

  const displayName = user?.username ?? user?.firstName ?? "User";
  const initials    = displayName.charAt(0).toUpperCase();
  const email       = user?.primaryEmailAddress?.emailAddress;
  const phone       = user?.primaryPhoneNumber?.phoneNumber;
  const isVerified  = user?.primaryEmailAddress?.verification.status === "verified";
  const fmtBalance  = `${currency === "KES" ? "KSh" : currency} ${balance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
  const memberId    = user?.id?.slice(-8).toUpperCase() ?? "—";

  const MENU = [
    { icon: "redeem",            label: "Bonuses",             sub: "Free spins and other offers" },
    { icon: "confirmation_number", label: "Bonus codes",       sub: "Code activation" },
    { icon: "history",           label: "Bet history",         sub: "Open and settled bets" },
    { icon: "receipt_long",      label: "Transaction history", sub: "Deposit and withdrawal statuses", action: () => { onClose(); onOpenWallet(); } },
  ];

  const SETTINGS_ITEMS = [
    { icon: "notifications", label: "Notifications",    sub: "Push & email alerts" },
    { icon: "security",      label: "Security & 2FA",   sub: "Password, two-factor auth" },
    { icon: "language",      label: "Language & Region",sub: "English · Kenya" },
    { icon: "support_agent", label: "Help & Support",   sub: "24/7 live chat" },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full flex-col overflow-hidden rounded-t-3xl bg-[#111316] shadow-2xl ring-1 ring-white/[0.08] sm:max-w-sm sm:rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-300"
        style={{ maxHeight: "90dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle mobile */}
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-white/10 sm:hidden" />

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            {view === "settings" && (
              <button
                type="button"
                onClick={() => setView("main")}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <Icon name="arrow_back" className="text-[16px]" />
              </button>
            )}
            <h2 className="text-lg font-black text-white">
              {view === "settings" ? "Settings" : "Profile"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="no-scrollbar flex-1 overflow-y-auto">
          {view === "main" ? (
            <>
              {/* Avatar + name */}
              <div className="flex flex-col items-center gap-2 px-5 pb-5 pt-1 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#087cff] to-[#0556c8] text-2xl font-black text-white shadow-[0_0_30px_rgba(8,124,255,0.4)]">
                  {initials}
                </div>
                <div>
                  <p className="text-lg font-black text-white">{displayName}</p>
                  <p className="font-mono text-[11px] text-slate-500">ID {memberId}</p>
                </div>
              </div>

              {/* Balance card */}
              <div className="mx-4 mb-4 overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.08]">
                <div className="px-4 pt-3 pb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Account</p>
                  <p className="mt-0.5 text-3xl font-black text-white">{fmtBalance}</p>
                </div>
                <div className="flex gap-2 px-4 pb-4">
                  <button
                    type="button"
                    onClick={() => { onClose(); onOpenWallet(); }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#05b957] py-2.5 text-sm font-black text-white transition hover:bg-[#07cc63] active:scale-[0.98]"
                  >
                    <Icon name="add_circle" fill className="text-[16px]" />
                    Deposit
                  </button>
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/[0.07] py-2.5 text-sm font-black text-slate-300 ring-1 ring-white/[0.09] transition hover:bg-white/[0.11] active:scale-[0.98]"
                  >
                    <Icon name="remove_circle" fill className="text-[16px] text-slate-400" />
                    Withdraw
                  </button>
                </div>
              </div>

              {/* Menu items */}
              <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
                {MENU.map((item, i) => (
                  <div key={item.label}>
                    <button
                      type="button"
                      onClick={item.action}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04] active:scale-[0.99]"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                        <Icon name={item.icon} fill className="text-[16px] text-slate-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-black text-white">{item.label}</p>
                        <p className="text-[11px] text-slate-500">{item.sub}</p>
                      </div>
                      <Icon name="chevron_right" className="text-[16px] text-slate-600" />
                    </button>
                    {i < MENU.length - 1 && <div className="mx-4 h-px bg-white/[0.05]" />}
                  </div>
                ))}
              </div>

              {/* Settings shortcut */}
              <div className="mx-4 mb-4 overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setView("settings")}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                    <Icon name="settings" fill className="text-[16px] text-slate-400" />
                  </div>
                  <span className="flex-1 text-[13px] font-black text-white">Settings</span>
                  <Icon name="chevron_right" className="text-[16px] text-slate-600" />
                </button>
              </div>

              {/* Sign out */}
              <div className="px-4 pb-6">
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    onClose();
                    toast.info("Signed out", "See you next time!");
                    router.push("/");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500/[0.07] py-3 text-sm font-black text-red-400 ring-1 ring-red-500/[0.12] transition hover:bg-red-500/[0.12] hover:ring-red-500/30"
                >
                  <Icon name="logout" className="text-[16px]" />
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            /* ── Settings view ── */
            <>
              {/* Contact info */}
              {(email || phone) && (
                <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
                  <p className="px-4 pt-3 pb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600">Contact Info</p>
                  {email && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Icon name="mail" fill className="text-[15px] text-slate-500" />
                        <div>
                          <p className="text-[12px] font-black text-white">{email}</p>
                          <p className="text-[10px] text-slate-600">Email address</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${isVerified ? "bg-emerald-500/12 text-emerald-400" : "bg-amber-500/12 text-amber-400"}`}>
                        {isVerified ? "Verified" : "Verify"}
                      </span>
                    </div>
                  )}
                  {email && phone && <div className="mx-4 h-px bg-white/[0.05]" />}
                  {phone && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Icon name="phone" fill className="text-[15px] text-slate-500" />
                        <div>
                          <p className="text-[12px] font-black text-white">{phone}</p>
                          <p className="text-[10px] text-slate-600">Phone number</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-black text-emerald-400">Verified</span>
                    </div>
                  )}
                </div>
              )}

              {/* Settings items */}
              <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
                {SETTINGS_ITEMS.map((item, i) => (
                  <div key={item.label}>
                    <button type="button" className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04]">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                        <Icon name={item.icon} fill className="text-[16px] text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-black text-white">{item.label}</p>
                        <p className="text-[11px] text-slate-500">{item.sub}</p>
                      </div>
                      <Icon name="chevron_right" className="text-[16px] text-slate-600" />
                    </button>
                    {i < SETTINGS_ITEMS.length - 1 && <div className="mx-4 h-px bg-white/[0.05]" />}
                  </div>
                ))}
              </div>

              {/* Active sessions */}
              <div className="mx-4 mb-4 overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                      <Icon name="devices" fill className="text-[16px] text-slate-400" />
                    </div>
                    <div>
                      <p className="text-[13px] font-black text-white">Active sessions</p>
                      <p className="text-[11px] text-slate-500">Log out on other devices</p>
                    </div>
                  </div>
                  <button type="button" className="text-xs font-black text-red-400 transition hover:text-red-300">End all</button>
                </div>
              </div>

              <div className="px-4 pb-6">
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    onClose();
                    toast.info("Signed out", "See you next time!");
                    router.push("/");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500/[0.07] py-3 text-sm font-black text-red-400 ring-1 ring-red-500/[0.12] transition hover:bg-red-500/[0.12] hover:ring-red-500/30"
                >
                  <Icon name="logout" className="text-[16px]" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
