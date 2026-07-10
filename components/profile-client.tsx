"use client";

import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { Icon } from "@/components/icon";
import Link from "next/link";
import { MONEY_LOCALE, CURRENCY_SYMBOL } from "@/lib/currency";

const QUICK_LINKS = [
  { href: "/wallet", icon: "account_balance_wallet", label: "Wallet & Deposits", sub: "Manage your funds" },
  { href: "/sports", icon: "sports_soccer", label: "My Bets", sub: "View betting history" },
  { href: "/wallet", icon: "confirmation_number", label: "Promotion code", sub: "Code activation" },
];

const SETTINGS = [
  { icon: "notifications", label: "Notifications", sub: "Manage alerts" },
  { icon: "security", label: "Security", sub: "Password & 2FA" },
  { icon: "language", label: "Language & Region", sub: "English · Kenya" },
  { icon: "help", label: "Help & Support", sub: "24/7 live chat" },
];

export function ProfileClient() {
  const { user, isLoaded, isSignedIn, signOut } = useSupabaseAuth();
  const router = useRouter();
  const { balance, currency } = useWalletBalance();

  if (!isLoaded) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#151518]">
        <svg className="h-7 w-7 animate-spin text-[#087cff]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 bg-[#151518] px-6 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-[#18191f] ring-1 ring-white/[0.06]">
          <Icon name="person" fill className="text-[40px] text-slate-500" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">Not signed in</h2>
          <p className="mt-1 text-sm text-slate-500">Log in to view your profile</p>
        </div>
      </div>
    );
  }

  const meta = user.user_metadata ?? {};
  const displayName = meta.username ?? meta.first_name ?? user.email?.split("@")[0] ?? "User";
  const initials = displayName.charAt(0).toUpperCase();
  const email = user.email;
  const phone = user.phone ?? meta.phone_number;
  const isVerified = user.email_confirmed_at != null;
  const fmtBalance = `${currency === "KES" ? CURRENCY_SYMBOL : currency} ${balance.toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2 })}`;
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-KE", { month: "long", year: "numeric" })
    : "—";

  return (
    <div className="w-full bg-[#151518] text-white">
      <div className="border-b border-white/[0.06] px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#087cff] text-2xl font-black text-white ring-2 ring-white/[0.08]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-black text-white">{displayName}</h1>
            <p className="mt-0.5 text-[12px] font-semibold text-slate-500">Member since {memberSince}</p>
            {isVerified && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[#087cff]/12 px-1.5 py-0.5 text-[10px] font-black text-[#75b8ff]">
                <Icon name="verified" fill className="text-[11px]" />
                Verified
              </span>
            )}
          </div>
        </div>

        <Link
          href="/wallet"
          className="mx-auto mt-5 flex max-w-2xl items-center justify-between gap-3 rounded-2xl bg-[#18191f] px-4 py-3.5 ring-1 ring-white/[0.06] transition hover:bg-[#1c1d24]"
        >
          <div className="flex items-center gap-2.5">
            <Icon name="account_balance_wallet" fill className="text-[18px] text-[#75b8ff]" />
            <span className="font-mono text-base font-black tabular-nums text-white">{fmtBalance}</span>
          </div>
          <span className="rounded-xl bg-[#05b957] px-3 py-1.5 text-[11px] font-black text-white">Deposit</span>
        </Link>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-5 sm:px-6">
        <section>
          <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Account info</p>
          <div className="overflow-hidden rounded-2xl bg-[#18191f] ring-1 ring-white/[0.06]">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#151518] ring-1 ring-white/[0.06]">
                <Icon name="badge" fill className="text-[16px] text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">User ID</p>
                <p className="font-mono text-sm font-bold text-white">{user.id.slice(-12).toUpperCase().replace(/-/g, "")}</p>
              </div>
            </div>

            {email && (
              <>
                <div className="mx-4 h-px bg-white/[0.05]" />
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#151518] ring-1 ring-white/[0.06]">
                    <Icon name="mail" fill className="text-[16px] text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Email</p>
                    <p className="truncate text-sm font-bold text-white">{email}</p>
                  </div>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-black ${isVerified ? "bg-emerald-500/12 text-emerald-400" : "bg-white/[0.06] text-slate-400"}`}>
                    {isVerified ? "Verified" : "Unverified"}
                  </span>
                </div>
              </>
            )}

            {phone && (
              <>
                <div className="mx-4 h-px bg-white/[0.05]" />
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#151518] ring-1 ring-white/[0.06]">
                    <Icon name="phone" fill className="text-[16px] text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Phone</p>
                    <p className="text-sm font-bold text-white">{phone}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-emerald-500/12 px-2 py-0.5 text-[10px] font-black text-emerald-400">
                    Verified
                  </span>
                </div>
              </>
            )}

            <div className="mx-4 h-px bg-white/[0.05]" />
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#151518] ring-1 ring-white/[0.06]">
                <Icon name="calendar_today" fill className="text-[16px] text-slate-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Member since</p>
                <p className="text-sm font-bold text-white">{memberSince}</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Quick actions</p>
          <div className="overflow-hidden rounded-2xl bg-[#18191f] ring-1 ring-white/[0.06]">
            {QUICK_LINKS.map((item, i) => (
              <div key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.03] active:scale-[0.99]"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#151518] ring-1 ring-white/[0.06]">
                    <Icon name={item.icon} fill className="text-[16px] text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black text-white">{item.label}</p>
                    <p className="text-[11px] font-semibold text-slate-500">{item.sub}</p>
                  </div>
                  <Icon name="chevron_right" className="text-[18px] text-slate-600" />
                </Link>
                {i < QUICK_LINKS.length - 1 && <div className="mx-4 h-px bg-white/[0.05]" />}
              </div>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Settings</p>
          <div className="overflow-hidden rounded-2xl bg-[#18191f] ring-1 ring-white/[0.06]">
            {SETTINGS.map((item, i) => (
              <div key={item.label}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03] active:scale-[0.99]"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#151518] ring-1 ring-white/[0.06]">
                    <Icon name={item.icon} fill className="text-[16px] text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black text-white">{item.label}</p>
                    <p className="text-[11px] font-semibold text-slate-500">{item.sub}</p>
                  </div>
                  <Icon name="chevron_right" className="text-[16px] text-slate-600" />
                </button>
                {i < SETTINGS.length - 1 && <div className="mx-4 h-px bg-white/[0.05]" />}
              </div>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.push("/");
            router.refresh();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500/[0.08] py-3.5 text-sm font-black text-red-400 ring-1 ring-red-500/15 transition hover:bg-red-500/[0.12] active:scale-[0.99]"
        >
          <Icon name="logout" className="text-[18px]" />
          Sign Out
        </button>

        <p className="pb-4 text-center text-[10px] text-slate-600">
          Nezeem · Account ID {user.id.slice(-8).toUpperCase().replace(/-/g, "")}
        </p>
      </div>
    </div>
  );
}
