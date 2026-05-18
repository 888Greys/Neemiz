"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { Icon } from "@/components/icon";
import Link from "next/link";

const QUICK_LINKS = [
  { href: "/wallet",  icon: "account_balance_wallet", label: "Wallet & Deposits",   sub: "Manage your funds",         color: "text-[#087cff]", bg: "bg-[#087cff]/10" },
  { href: "/sports",  icon: "sports_soccer",          label: "My Bets",              sub: "View betting history",      color: "text-emerald-400", bg: "bg-emerald-400/10" },
  { href: "/wallet",  icon: "redeem",                 label: "Bonuses & Rewards",    sub: "Your active promotions",    color: "text-amber-400",  bg: "bg-amber-400/10" },
];

const SETTINGS = [
  { icon: "notifications",   label: "Notifications",       sub: "Manage alerts" },
  { icon: "security",        label: "Security",             sub: "Password & 2FA" },
  { icon: "language",        label: "Language & Region",    sub: "English · Kenya" },
  { icon: "help",            label: "Help & Support",       sub: "24/7 live chat" },
];

export function ProfileClient() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const { balance, currency } = useWalletBalance();

  if (!isLoaded) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <svg className="h-7 w-7 animate-spin text-[#087cff]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.06]">
          <Icon name="person" fill className="text-[40px] text-slate-500" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">Not signed in</h2>
          <p className="mt-1 text-sm text-slate-500">Log in to view your profile</p>
        </div>
      </div>
    );
  }

  const displayName = user.username ?? user.firstName ?? "User";
  const initials    = displayName.charAt(0).toUpperCase();
  const email       = user.primaryEmailAddress?.emailAddress;
  const phone       = user.primaryPhoneNumber?.phoneNumber;
  const isVerified  = user.primaryEmailAddress?.verification.status === "verified";
  const fmtBalance  = `${currency === "KES" ? "KSh" : currency} ${balance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-KE", { month: "long", year: "numeric" })
    : "—";

  return (
    <div className="w-full">
      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#111420] to-[#0d0e11] px-6 pb-8 pt-10">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#087cff]/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-[#05b957]/8 blur-2xl" />

        {/* Avatar */}
        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#087cff] to-[#0556c8] text-4xl font-black text-white shadow-[0_0_40px_rgba(8,124,255,0.35)]">
              {initials}
            </div>
            {/* Online dot */}
            <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-[#111420]" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-white">{displayName}</h1>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-black text-amber-400">
                PLATINUM
              </span>
              <span className="text-[11px] text-slate-500">· Member since {memberSince}</span>
            </div>
          </div>

          {/* Balance pill */}
          <Link
            href="/wallet"
            className="mt-1 flex items-center gap-2.5 rounded-2xl bg-white/[0.07] px-5 py-2.5 ring-1 ring-white/[0.10] transition hover:bg-white/[0.11]"
          >
            <Icon name="account_balance_wallet" fill className="text-[16px] text-[#087cff]" />
            <span className="text-base font-black text-white">{fmtBalance}</span>
            <span className="rounded-lg bg-[#05b957] px-2.5 py-0.5 text-[10px] font-black text-white">Deposit</span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        {/* ── Account Info ── */}
        <section>
          <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">Account Info</p>
          <div className="overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
            {/* User ID */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                <Icon name="badge" fill className="text-[16px] text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">User ID</p>
                <p className="font-mono text-sm font-bold text-white">{user.id.slice(-12).toUpperCase()}</p>
              </div>
            </div>

            <div className="mx-4 h-px bg-white/[0.05]" />

            {/* Email */}
            {email && (
              <>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                    <Icon name="mail" fill className="text-[16px] text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Email</p>
                    <p className="truncate text-sm font-bold text-white">{email}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black ${isVerified ? "bg-emerald-500/12 text-emerald-400" : "bg-amber-500/12 text-amber-400"}`}>
                    {isVerified ? "Verified" : "Unverified"}
                  </span>
                </div>
                <div className="mx-4 h-px bg-white/[0.05]" />
              </>
            )}

            {/* Phone */}
            {phone && (
              <>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                    <Icon name="phone" fill className="text-[16px] text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Phone</p>
                    <p className="text-sm font-bold text-white">{phone}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-[10px] font-black text-emerald-400">
                    Verified
                  </span>
                </div>
                <div className="mx-4 h-px bg-white/[0.05]" />
              </>
            )}

            {/* Joined */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                <Icon name="calendar_today" fill className="text-[16px] text-slate-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Member since</p>
                <p className="text-sm font-bold text-white">{memberSince}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Quick Actions ── */}
        <section>
          <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">Quick Actions</p>
          <div className="space-y-2">
            {QUICK_LINKS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 py-3.5 ring-1 ring-white/[0.07] transition hover:bg-[#1e1f27] hover:ring-white/[0.12] active:scale-[0.99]"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.bg}`}>
                  <Icon name={item.icon} fill className={`text-[18px] ${item.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-black text-white">{item.label}</p>
                  <p className="text-[11px] text-slate-500">{item.sub}</p>
                </div>
                <Icon name="chevron_right" className="text-[18px] text-slate-600" />
              </Link>
            ))}
          </div>
        </section>

        {/* ── Settings ── */}
        <section>
          <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">Settings</p>
          <div className="overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
            {SETTINGS.map((item, i) => (
              <div key={item.label}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04] active:scale-[0.99]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
                    <Icon name={item.icon} fill className="text-[16px] text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black text-white">{item.label}</p>
                    <p className="text-[11px] text-slate-500">{item.sub}</p>
                  </div>
                  <Icon name="chevron_right" className="text-[16px] text-slate-600" />
                </button>
                {i < SETTINGS.length - 1 && <div className="mx-4 h-px bg-white/[0.05]" />}
              </div>
            ))}
          </div>
        </section>

        {/* ── Sign out ── */}
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500/[0.07] py-3.5 text-sm font-black text-red-400 ring-1 ring-red-500/[0.12] transition hover:bg-red-500/[0.12] hover:ring-red-500/30 active:scale-[0.99]"
        >
          <Icon name="logout" className="text-[18px]" />
          Sign Out
        </button>

        <p className="pb-4 text-center text-[10px] text-slate-700">
          Nezeem · Account ID {user.id.slice(-8).toUpperCase()}
        </p>
      </div>
    </div>
  );
}
