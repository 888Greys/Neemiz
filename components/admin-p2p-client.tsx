"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type KycStatus = "PENDING" | "APPROVED" | "REJECTED";
type DepositStatus = "PENDING" | "APPROVED" | "REJECTED";

interface MerchantKyc {
  id: string;
  displayName: string;
  kycStatus: KycStatus;
  createdAt: string;
  user: { email: string | null; firstName: string | null; lastName: string | null };
}

interface Dispute {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  order: {
    id: string;
    crypto: string;
    cryptoAmount: number;
    fiatAmount: number;
    buyer: { firstName: string | null; lastName: string | null; username: string | null };
    seller: { displayName: string };
  };
}

interface AdminDeposit {
  id: string;
  crypto: string;
  amount: number;
  txHash: string;
  network: string;
  status: DepositStatus;
  createdAt: string;
  merchant: { displayName: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function KycBadge({ status }: { status: KycStatus }) {
  const map: Record<KycStatus, string> = {
    PENDING:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
    APPROVED: "bg-[#31c45d]/10 text-[#31c45d] border-[#31c45d]/20",
    REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-black ${map[status]}`}>
      {status}
    </span>
  );
}

function DepositBadge({ status }: { status: DepositStatus }) {
  const map: Record<DepositStatus, string> = {
    PENDING:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
    APPROVED: "bg-[#31c45d]/10 text-[#31c45d] border-[#31c45d]/20",
    REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-black ${map[status]}`}>
      {status}
    </span>
  );
}

function Spinner() {
  return <div className="w-6 h-6 border-2 border-white/10 border-t-[#087cff] rounded-full animate-spin" />;
}

// ─── KYC Requests Tab ────────────────────────────────────────────────────────

function KycRequestsTab({ onAction }: { onAction: () => void }) {
  const [filter, setFilter]           = useState<KycStatus>("PENDING");
  const [merchants, setMerchants]     = useState<MerchantKyc[]>([]);
  const [loading, setLoading]         = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote]   = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchMerchants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/p2p/merchants?status=${filter}`);
      if (res.ok) setMerchants(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchMerchants(); }, [fetchMerchants]);

  async function doAction(id: string, action: "approve" | "reject", note?: string) {
    setActionLoading(`${action}-${id}`);
    try {
      const res = await fetch(`/api/admin/p2p/merchants/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(`Merchant ${action}d`);
      setRejectingId(null);
      setRejectNote("");
      fetchMerchants();
      onAction();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  function userName(m: MerchantKyc) {
    return m.user.firstName ? `${m.user.firstName} ${m.user.lastName ?? ""}`.trim() : m.user.email ?? "Unknown";
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
              filter === s
                ? s === "PENDING" ? "bg-amber-500/20 text-amber-400"
                  : s === "APPROVED" ? "bg-[#31c45d]/20 text-[#31c45d]"
                  : "bg-red-500/20 text-red-400"
                : "bg-white/5 text-slate-500 hover:text-slate-300"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : merchants.length === 0 ? (
        <div className="text-center py-16 bg-[#0f1623] border border-white/[0.06] rounded-2xl">
          <Icon name="storefront" className="text-4xl text-slate-700 mb-3" />
          <p className="text-slate-400 font-bold">No {filter.toLowerCase()} merchants</p>
        </div>
      ) : (
        <div className="bg-[#0f1623] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Merchant Name", "User Email", "Applied", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3.5 text-left text-xs font-black text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {merchants.map((m, i) => (
                  <>
                    <tr
                      key={m.id}
                      className={`${i < merchants.length - 1 ? "border-b border-white/[0.04]" : ""} hover:bg-white/[0.02] transition-colors`}
                    >
                      <td className="px-4 py-3.5">
                        <p className="text-white font-black text-sm">{m.displayName}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-slate-400 text-xs">{userName(m)}</p>
                        <p className="text-slate-600 text-[10px]">{m.user.email}</p>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3.5">
                        <KycBadge status={m.kycStatus} />
                      </td>
                      <td className="px-4 py-3.5">
                        {m.kycStatus === "PENDING" && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => doAction(m.id, "approve")}
                              disabled={!!actionLoading}
                              className="px-3 py-1.5 rounded-lg bg-[#31c45d]/10 text-[#31c45d] text-xs font-black border border-[#31c45d]/20 hover:bg-[#31c45d]/20 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === `approve-${m.id}` ? "…" : "Approve"}
                            </button>
                            <button
                              onClick={() => { setRejectingId(m.id); setRejectNote(""); }}
                              disabled={!!actionLoading}
                              className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-black border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {rejectingId === m.id && (
                      <tr key={`reject-form-${m.id}`} className="border-b border-white/[0.04] bg-red-500/5">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <textarea
                              value={rejectNote}
                              onChange={(e) => setRejectNote(e.target.value)}
                              placeholder="Rejection note (required)…"
                              rows={2}
                              className="flex-1 bg-white/5 border border-red-500/30 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none resize-none"
                            />
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => {
                                  if (!rejectNote.trim()) return toast.error("Note is required");
                                  doAction(m.id, "reject", rejectNote.trim());
                                }}
                                disabled={!rejectNote.trim() || !!actionLoading}
                                className="px-4 py-1.5 rounded-lg bg-red-500 text-white text-xs font-black hover:bg-red-600 disabled:opacity-50 transition-colors"
                              >
                                {actionLoading === `reject-${m.id}` ? "…" : "Confirm Reject"}
                              </button>
                              <button
                                onClick={() => setRejectingId(null)}
                                className="px-4 py-1.5 rounded-lg bg-white/5 text-slate-400 text-xs font-bold hover:bg-white/10 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Disputes Tab ─────────────────────────────────────────────────────────────

function DisputesTab({ onAction }: { onAction: () => void }) {
  const [disputes, setDisputes]       = useState<Dispute[]>([]);
  const [loading, setLoading]         = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolution, setResolution]   = useState<"BUYER_WINS" | "SELLER_WINS" | null>(null);
  const [note, setNote]               = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/p2p/disputes");
      if (res.ok) setDisputes(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

  async function resolve(id: string) {
    if (!resolution) return toast.error("Select a resolution");
    if (!note.trim()) return toast.error("Note is required");
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/p2p/disputes/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Dispute resolved");
      setResolvingId(null);
      setResolution(null);
      setNote("");
      fetchDisputes();
      onAction();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  }

  function buyerName(d: Dispute) {
    const b = d.order.buyer;
    return b.firstName ? `${b.firstName} ${b.lastName ?? ""}`.trim() : b.username ?? "—";
  }

  return (
    <div>
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-16 bg-[#0f1623] border border-white/[0.06] rounded-2xl">
          <Icon name="gavel" className="text-4xl text-slate-700 mb-3" />
          <p className="text-slate-400 font-bold">No disputes to resolve</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <div key={d.id} className="bg-[#0f1623] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-black">DISPUTED</span>
                    <span className="text-slate-600 text-xs font-mono">#{d.order.id.slice(0, 12).toUpperCase()}</span>
                  </div>
                  <p className="text-white font-black text-sm">
                    {Number(d.order.cryptoAmount).toFixed(6)} {d.order.crypto}
                    <span className="text-slate-500 font-medium ml-2">· KSh {Number(d.order.fiatAmount).toLocaleString("en-KE")}</span>
                  </p>
                </div>
                <Link
                  href={`/p2p/order/${d.order.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 text-slate-400 text-xs font-bold hover:bg-white/10 hover:text-white transition-colors"
                  target="_blank"
                >
                  View Order
                  <Icon name="open_in_new" className="text-[13px]" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-slate-600 text-xs mb-0.5">Buyer</p>
                  <p className="text-slate-300 text-sm font-bold">{buyerName(d)}</p>
                </div>
                <div>
                  <p className="text-slate-600 text-xs mb-0.5">Seller (Merchant)</p>
                  <p className="text-slate-300 text-sm font-bold">{d.order.seller.displayName}</p>
                </div>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 mb-4">
                <p className="text-slate-500 text-xs mb-0.5">Dispute reason</p>
                <p className="text-slate-300 text-sm">{d.reason}</p>
              </div>

              {resolvingId === d.id ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {(["BUYER_WINS", "SELLER_WINS"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setResolution(r)}
                        className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all ${
                          resolution === r
                            ? r === "BUYER_WINS"
                              ? "bg-[#087cff]/20 border-[#087cff] text-[#087cff]"
                              : "bg-[#31c45d]/20 border-[#31c45d] text-[#31c45d]"
                            : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                        }`}
                      >
                        {r === "BUYER_WINS" ? "Buyer Wins" : "Seller Wins"}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Resolution note (required)…"
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none resize-none focus:border-[#087cff]/40"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setResolvingId(null); setResolution(null); setNote(""); }}
                      className="flex-1 py-2.5 rounded-xl font-bold text-slate-400 bg-white/5 hover:bg-white/10 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => resolve(d.id)}
                      disabled={!resolution || !note.trim() || actionLoading === d.id}
                      className="flex-1 py-2.5 rounded-xl font-black text-white bg-[#087cff] hover:bg-[#0570e8] disabled:opacity-50 transition-all text-sm"
                    >
                      {actionLoading === d.id ? "Resolving…" : "Resolve Dispute"}
                    </button>
                  </div>
                </div>
              ) : d.status === "DISPUTED" ? (
                <button
                  onClick={() => { setResolvingId(d.id); setResolution(null); setNote(""); }}
                  className="w-full py-2.5 rounded-xl font-black text-white bg-[#087cff] hover:bg-[#0570e8] transition-all text-sm"
                >
                  Resolve Dispute
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Icon name="check_circle" className="text-[#31c45d] text-base" />
                  <span className="text-[#31c45d] text-sm font-bold">Resolved: {d.status}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Deposits Tab ─────────────────────────────────────────────────────────────

function DepositsTab({ onAction }: { onAction: () => void }) {
  const [deposits, setDeposits]       = useState<AdminDeposit[]>([]);
  const [loading, setLoading]         = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote]   = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedId, setCopiedId]       = useState<string | null>(null);

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/p2p/deposits");
      if (res.ok) setDeposits(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  async function doAction(id: string, action: "approve" | "reject", note?: string) {
    setActionLoading(`${action}-${id}`);
    try {
      const res = await fetch(`/api/admin/p2p/deposits/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(`Deposit ${action}d`);
      setRejectingId(null);
      setRejectNote("");
      fetchDeposits();
      onAction();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  function copyHash(hash: string, id: string) {
    navigator.clipboard.writeText(hash).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <div>
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : deposits.length === 0 ? (
        <div className="text-center py-16 bg-[#0f1623] border border-white/[0.06] rounded-2xl">
          <Icon name="south_america" className="text-4xl text-slate-700 mb-3" />
          <p className="text-slate-400 font-bold">No pending deposits</p>
        </div>
      ) : (
        <div className="bg-[#0f1623] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Merchant", "Crypto", "Amount", "Network", "TX Hash", "Submitted", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3.5 text-left text-xs font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deposits.map((d, i) => (
                  <>
                    <tr
                      key={d.id}
                      className={`${i < deposits.length - 1 ? "border-b border-white/[0.04]" : ""} hover:bg-white/[0.02] transition-colors`}
                    >
                      <td className="px-4 py-3.5 text-white font-bold whitespace-nowrap">{d.merchant.displayName}</td>
                      <td className="px-4 py-3.5 text-white font-black">{d.crypto}</td>
                      <td className="px-4 py-3.5 text-white font-black">{Number(d.amount).toFixed(6)}</td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs">{d.network}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-slate-400 text-xs">
                            {d.txHash.length > 14 ? `${d.txHash.slice(0, 7)}…${d.txHash.slice(-7)}` : d.txHash}
                          </span>
                          <button
                            onClick={() => copyHash(d.txHash, d.id)}
                            title="Copy TX hash"
                            className="text-slate-600 hover:text-slate-300 transition-colors"
                          >
                            <Icon name={copiedId === d.id ? "check" : "content_copy"} className="text-[13px]" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                        {new Date(d.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "2-digit" })}
                      </td>
                      <td className="px-4 py-3.5">
                        <DepositBadge status={d.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        {d.status === "PENDING" && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => doAction(d.id, "approve")}
                              disabled={!!actionLoading}
                              className="px-3 py-1.5 rounded-lg bg-[#31c45d]/10 text-[#31c45d] text-xs font-black border border-[#31c45d]/20 hover:bg-[#31c45d]/20 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                              {actionLoading === `approve-${d.id}` ? "…" : "Approve"}
                            </button>
                            <button
                              onClick={() => { setRejectingId(d.id); setRejectNote(""); }}
                              disabled={!!actionLoading}
                              className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-black border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {rejectingId === d.id && (
                      <tr key={`reject-${d.id}`} className="border-b border-white/[0.04] bg-red-500/5">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              value={rejectNote}
                              onChange={(e) => setRejectNote(e.target.value)}
                              placeholder="Rejection note (optional)…"
                              className="flex-1 bg-white/5 border border-red-500/30 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none"
                            />
                            <button
                              onClick={() => doAction(d.id, "reject", rejectNote || undefined)}
                              disabled={!!actionLoading}
                              className="px-4 py-2 rounded-lg bg-red-500 text-white text-xs font-black hover:bg-red-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                              {actionLoading === `reject-${d.id}` ? "…" : "Confirm Reject"}
                            </button>
                            <button
                              onClick={() => setRejectingId(null)}
                              className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 text-xs font-bold hover:bg-white/10 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Admin P2P Client ────────────────────────────────────────────────────

type AdminTab = "kyc" | "disputes" | "deposits";

interface PendingCounts { kyc: number; disputes: number; deposits: number }

export function AdminP2PClient() {
  const [tab, setTab]       = useState<AdminTab>("kyc");
  const [counts, setCounts] = useState<PendingCounts>({ kyc: 0, disputes: 0, deposits: 0 });

  const fetchCounts = useCallback(async () => {
    try {
      const [kycRes, disputesRes, depositsRes] = await Promise.all([
        fetch("/api/admin/p2p/merchants?status=PENDING"),
        fetch("/api/admin/p2p/disputes"),
        fetch("/api/admin/p2p/deposits"),
      ]);
      const [kyc, disputes, deposits] = await Promise.all([
        kycRes.ok      ? kycRes.json()      : [],
        disputesRes.ok ? disputesRes.json() : [],
        depositsRes.ok ? depositsRes.json() : [],
      ]);
      setCounts({
        kyc:      Array.isArray(kyc)      ? kyc.length                                             : 0,
        disputes: Array.isArray(disputes) ? disputes.filter((d: Dispute) => d.status === "DISPUTED").length : 0,
        deposits: Array.isArray(deposits) ? deposits.filter((d: AdminDeposit) => d.status === "PENDING").length : 0,
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const tabs: { id: AdminTab; label: string; icon: string; count: number }[] = [
    { id: "kyc",      label: "KYC Requests", icon: "verified_user", count: counts.kyc      },
    { id: "disputes", label: "Disputes",      icon: "gavel",         count: counts.disputes },
    { id: "deposits", label: "Deposits",      icon: "south_america", count: counts.deposits },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white mb-1">P2P Admin Dashboard</h1>
        <p className="text-slate-500 text-sm">Review KYC requests, resolve disputes, and manage crypto deposits.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0f1623] border border-white/[0.06] rounded-2xl p-1.5 mb-6 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all ${
              tab === t.id
                ? "bg-[#087cff] text-white shadow-[0_2px_12px_rgba(8,124,255,.35)]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Icon name={t.icon} className="text-base" />
            {t.label}
            {t.count > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black leading-none ${
                tab === t.id
                  ? "bg-white text-[#087cff]"
                  : "bg-amber-500 text-white"
              }`}>
                {t.count > 99 ? "99+" : t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "kyc"      && <KycRequestsTab onAction={fetchCounts} />}
      {tab === "disputes" && <DisputesTab    onAction={fetchCounts} />}
      {tab === "deposits" && <DepositsTab    onAction={fetchCounts} />}
    </div>
  );
}
