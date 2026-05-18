"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { Icon } from "@/components/icon";
import Link from "next/link";

export function ProfileClient() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const { balance, currency } = useWalletBalance();

  if (!isLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <svg className="h-6 w-6 animate-spin text-[#087cff]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Icon name="lock" fill className="text-[40px] text-slate-600" />
        <p className="text-slate-400">Sign in to view your profile</p>
      </div>
    );
  }

  const displayName = user.username ?? user.firstName ?? "User";
  const initials = displayName.charAt(0).toUpperCase();
  const email = user.primaryEmailAddress?.emailAddress;
  const phone = user.primaryPhoneNumber?.phoneNumber;
  const fmtBalance = `${currency === "KES" ? "KSh" : currency} ${balance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      {/* Avatar + name */}
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#087cff] text-3xl font-black text-white">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">{displayName}</h1>
          <p className="text-xs text-slate-500 mt-0.5">ID {user.id.slice(-10)}</p>
        </div>
      </div>

      {/* Balance card */}
      <Link href="/wallet" className="mb-4 flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#087cff]/20 to-[#0d0e11] px-5 py-4 ring-1 ring-white/[0.08] transition hover:ring-[#087cff]/40">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Wallet Balance</p>
          <p className="text-2xl font-black text-white">{fmtBalance}</p>
        </div>
        <span className="rounded-xl bg-[#05b957] px-4 py-2 text-sm font-black text-white">Deposit</span>
      </Link>

      {/* Info cards */}
      <div className="space-y-2 mb-6">
        {email && (
          <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 py-3.5 ring-1 ring-white/[0.07]">
            <Icon name="mail" fill className="text-[18px] shrink-0 text-slate-500" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Email</p>
              <p className="truncate text-sm font-bold text-white">{email}</p>
            </div>
            {user.primaryEmailAddress?.verification.status === "verified" ? (
              <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-400">Verified</span>
            ) : (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-400">Unverified</span>
            )}
          </div>
        )}
        {phone && (
          <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 py-3.5 ring-1 ring-white/[0.07]">
            <Icon name="phone" fill className="text-[18px] shrink-0 text-slate-500" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Phone</p>
              <p className="truncate text-sm font-bold text-white">{phone}</p>
            </div>
            {user.primaryPhoneNumber?.verification.status === "verified" ? (
              <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-400">Verified</span>
            ) : (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-400">Unverified</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 py-3.5 ring-1 ring-white/[0.07]">
          <Icon name="calendar_today" fill className="text-[18px] shrink-0 text-slate-500" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Member since</p>
            <p className="text-sm font-bold text-white">
              {new Date(user.createdAt!).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="space-y-2 mb-6">
        {[
          { href: "/wallet", icon: "account_balance_wallet", label: "Wallet & Transactions" },
          { href: "/sports", icon: "sports_soccer", label: "My Bets" },
        ].map((item) => (
          <Link key={item.href} href={item.href}
            className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 py-3.5 ring-1 ring-white/[0.07] transition hover:bg-[#1e1f26] hover:ring-white/[0.12]">
            <Icon name={item.icon} fill className="text-[18px] shrink-0 text-slate-400" />
            <span className="flex-1 text-sm font-bold text-white">{item.label}</span>
            <Icon name="chevron_right" className="text-[18px] text-slate-600" />
          </Link>
        ))}
      </div>

      {/* Sign out */}
      <button
        type="button"
        onClick={handleSignOut}
        className="w-full rounded-2xl bg-white/[0.04] py-3.5 text-sm font-black text-red-400 ring-1 ring-white/[0.07] transition hover:bg-red-500/10 hover:ring-red-500/30"
      >
        Sign Out
      </button>
    </div>
  );
}
