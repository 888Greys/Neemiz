"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

interface Stats {
  totalUsers: number;
  newUsersToday: number;
  pendingKyc: number;
  openDisputes: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  totalMerchants: number;
  activeOrders: number;
  depositsToday: { count: number; amount: number };
  depositsMonth: { count: number; amount: number };
}

function StatCard({
  label, value, sub, icon, color, href, alert,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  color: string;
  href?: string;
  alert?: boolean;
}) {
  const inner = (
    <div className={`relative overflow-hidden rounded-2xl bg-[#0f1623] border border-white/[0.06] p-5 transition-colors ${href ? "hover:bg-white/[0.03] cursor-pointer" : ""}`}>
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
          <Icon name={icon} fill className="text-[20px]" />
        </div>
        {alert && <span className="flex h-2 w-2 rounded-full bg-amber-400"><span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-amber-400 opacity-75" /></span>}
      </div>
      <div className="mt-4">
        <p className="text-3xl font-black text-white">{value}</p>
        <p className="mt-0.5 text-xs font-black text-slate-500 uppercase tracking-wide">{label}</p>
        {sub && <p className="mt-1 text-[11px] text-slate-600">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

function Spinner() {
  return <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#087cff]" />;
}

export function AdminDashboardClient({ adminEmail }: { adminEmail: string }) {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) setStats(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Overview</h1>
          <p className="text-slate-600 text-xs mt-0.5">Live platform stats</p>
        </div>
        <button
          type="button"
          onClick={fetchStats}
          className="flex items-center gap-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-xs font-bold text-slate-500 hover:text-white hover:bg-white/[0.07] transition-colors"
        >
          <Icon name="refresh" className="text-[13px]" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : stats ? (
        <>
          {/* Alerts row */}
          {(stats.pendingKyc > 0 || stats.openDisputes > 0 || stats.pendingDeposits > 0 || stats.pendingWithdrawals > 0) && (
            <div className="mb-6 flex flex-wrap gap-3">
              {stats.pendingKyc > 0 && (
                <Link href="/admin/p2p" className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 text-xs font-black text-amber-400 hover:bg-amber-500/15 transition-colors">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {stats.pendingKyc} KYC request{stats.pendingKyc !== 1 ? "s" : ""} pending
                  <Icon name="chevron_right" className="text-[14px]" />
                </Link>
              )}
              {stats.openDisputes > 0 && (
                <Link href="/admin/p2p" className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-xs font-black text-red-400 hover:bg-red-500/15 transition-colors">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                  {stats.openDisputes} open dispute{stats.openDisputes !== 1 ? "s" : ""}
                  <Icon name="chevron_right" className="text-[14px]" />
                </Link>
              )}
              {stats.pendingDeposits > 0 && (
                <Link href="/admin/p2p" className="flex items-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-2.5 text-xs font-black text-blue-400 hover:bg-blue-500/15 transition-colors">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  {stats.pendingDeposits} deposit{stats.pendingDeposits !== 1 ? "s" : ""} to review
                  <Icon name="chevron_right" className="text-[14px]" />
                </Link>
              )}
              {stats.pendingWithdrawals > 0 && (
                <Link href="/admin/withdrawals" className="flex items-center gap-2 rounded-xl bg-orange-500/10 border border-orange-500/20 px-4 py-2.5 text-xs font-black text-orange-400 hover:bg-orange-500/15 transition-colors">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
                  {stats.pendingWithdrawals} withdrawal{stats.pendingWithdrawals !== 1 ? "s" : ""} awaiting approval
                  <Icon name="chevron_right" className="text-[14px]" />
                </Link>
              )}
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <StatCard
              label="Total Users"
              value={stats.totalUsers.toLocaleString()}
              sub={`+${stats.newUsersToday} today`}
              icon="groups"
              color="bg-violet-500/15 text-violet-300"
            />
            <StatCard
              label="Merchants"
              value={stats.totalMerchants.toLocaleString()}
              sub="KYC approved"
              icon="storefront"
              color="bg-emerald-500/15 text-emerald-300"
              href="/admin/p2p"
            />
            <StatCard
              label="Active Orders"
              value={stats.activeOrders.toLocaleString()}
              sub="Pending + Paid"
              icon="swap_horiz"
              color="bg-blue-500/15 text-blue-300"
            />
            <StatCard
              label="KYC Pending"
              value={stats.pendingKyc}
              sub="awaiting review"
              icon="verified_user"
              color="bg-amber-500/15 text-amber-300"
              href="/admin/p2p"
              alert={stats.pendingKyc > 0}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <StatCard
              label="Open Disputes"
              value={stats.openDisputes}
              sub="requires resolution"
              icon="gavel"
              color="bg-red-500/15 text-red-300"
              href="/admin/p2p"
              alert={stats.openDisputes > 0}
            />
            <StatCard
              label="Deposits Today"
              value={`KSh ${stats.depositsToday.amount.toLocaleString("en-KE")}`}
              sub={`${stats.depositsToday.count} transactions`}
              icon="add_circle"
              color="bg-[#05b957]/15 text-[#05b957]"
            />
            <StatCard
              label="Month Deposits"
              value={`KSh ${stats.depositsMonth.amount.toLocaleString("en-KE")}`}
              sub={`${stats.depositsMonth.count} transactions`}
              icon="calendar_month"
              color="bg-sky-500/15 text-sky-300"
            />
            <StatCard
              label="Pending Deposits"
              value={stats.pendingDeposits}
              sub="merchant crypto"
              icon="pending"
              color="bg-slate-500/15 text-slate-300"
              href="/admin/p2p"
              alert={stats.pendingDeposits > 0}
            />
          </div>

          {/* Quick links */}
          <div>
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Link
                href="/admin/p2p"
                className="flex items-center gap-4 rounded-2xl bg-[#0f1623] border border-white/[0.06] p-5 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#087cff]/15">
                  <Icon name="swap_horiz" fill className="text-[22px] text-[#087cff]" />
                </div>
                <div>
                  <p className="font-black text-white text-sm">P2P Management</p>
                  <p className="text-slate-500 text-xs">KYC · Disputes · Deposits</p>
                </div>
                <Icon name="chevron_right" className="text-[18px] text-slate-600 ml-auto" />
              </Link>

              <Link
                href="/admin/p2p"
                className="flex items-center gap-4 rounded-2xl bg-[#0f1623] border border-white/[0.06] p-5 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15">
                  <Icon name="verified_user" fill className="text-[22px] text-amber-400" />
                </div>
                <div>
                  <p className="font-black text-white text-sm">KYC Requests</p>
                  <p className="text-slate-500 text-xs">
                    {stats.pendingKyc > 0 ? <span className="text-amber-400">{stats.pendingKyc} pending</span> : "All cleared"}
                  </p>
                </div>
                <Icon name="chevron_right" className="text-[18px] text-slate-600 ml-auto" />
              </Link>

              <Link
                href="/admin/p2p"
                className="flex items-center gap-4 rounded-2xl bg-[#0f1623] border border-white/[0.06] p-5 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/15">
                  <Icon name="gavel" fill className="text-[22px] text-red-400" />
                </div>
                <div>
                  <p className="font-black text-white text-sm">Disputes</p>
                  <p className="text-slate-500 text-xs">
                    {stats.openDisputes > 0 ? <span className="text-red-400">{stats.openDisputes} open</span> : "None open"}
                  </p>
                </div>
                <Icon name="chevron_right" className="text-[18px] text-slate-600 ml-auto" />
              </Link>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl bg-[#0f1623] border border-white/[0.06] p-12 text-center">
          <p className="text-slate-500 font-bold">Failed to load stats</p>
        </div>
      )}
    </div>
  );
}
