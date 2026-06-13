"use client";

import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type KycStatus = "PENDING" | "APPROVED" | "REJECTED";
type DepositStatus = "PENDING" | "APPROVED" | "REJECTED";

type WalletFamily = "EVM" | "TRON" | "BTC";

interface CryptoWallet {
  address:        string;
  family:         WalletFamily;
  derivationPath: string;
  coins:          { crypto: string; network: string }[];
  owner:          { id: string; email: string | null; username: string | null };
  createdAt:      string;
}

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
  evidence: string | null;
  raisedById?: string;
  order: {
    id: string;
    crypto: string;
    cryptoAmount: number;
    fiatAmount: number;
    paymentRef: string | null;
    paymentProofUrl: string | null;
    ad: { side: "BUY" | "SELL"; fiat: string };
    buyer: { id: string; firstName: string | null; lastName: string | null; username: string | null };
    seller: { displayName: string; userId: string };
    // Only present on the per-case detail fetch, not in list rows.
    messages?: Array<{
      id: string;
      content: string;
      imageUrl: string | null;
      createdAt: string;
      senderId: string;
      sender: { firstName: string | null; lastName: string | null; username: string | null };
    }>;
  };
}

interface AdminDeposit {
  id: string;
  crypto: string;
  amount: number;
  txHash: string | null;
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
        <div className="admin-panel text-center py-16">
          <Icon name="storefront" className="text-4xl text-slate-700 mb-3" />
          <p className="text-slate-400 font-bold">No {filter.toLowerCase()} merchants</p>
        </div>
      ) : (
        <div className="admin-panel overflow-hidden">
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

const DEFAULT_PROOF_REQUEST =
  "Hello, this is Nezeem Support. To resolve this dispute fairly we need proof of payment from both sides. Please upload a clear screenshot of your M-Pesa confirmation message or bank transfer slip showing the reference, amount, date and time. Thank you.";

function DisputesTab({ onAction }: { onAction: () => void }) {
  const [filter, setFilter]           = useState<"ALL" | "OPEN" | "RESOLVED">("ALL");
  const [disputes, setDisputes]       = useState<Dispute[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [detail, setDetail]           = useState<Dispute | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolution, setResolution]   = useState<"CRYPTO_BUYER_WINS" | "CRYPTO_SELLER_WINS" | null>(null);
  const [note, setNote]               = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [proofingId, setProofingId]   = useState<string | null>(null);
  const [proofMsg, setProofMsg]       = useState("");

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === "ALL" ? "/api/admin/p2p/disputes" : `/api/admin/p2p/disputes?status=${filter}`;
      const res = await fetch(url);
      if (res.ok) setDisputes(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/p2p/disputes/${id}`);
      if (res.ok) setDetail(await res.json());
    } catch { /* ignore */ } finally {
      setDetailLoading(false);
    }
  }, []);

  function openDispute(id: string) {
    setSelectedId(id);
    setDetail(null);
    resetTransient();
    loadDetail(id);
  }

  async function requestProof(id: string) {
    setActionLoading(`proof-${id}`);
    try {
      const res = await fetch(`/api/admin/p2p/disputes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: proofMsg.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Proof request sent to both parties");
      setProofingId(null);
      setProofMsg("");
      loadDetail(id); // refresh so the new support message appears
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  }

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
      setSelectedId(null); // back to the list
      setDetail(null);
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

  function resetTransient() {
    setResolvingId(null); setResolution(null); setNote("");
    setProofingId(null); setProofMsg("");
  }

  const listItem = disputes.find((d) => d.id === selectedId) ?? null;

  // ───── Detail view: a single dispute, opened from the list ─────
  if (selectedId && (listItem || detail)) {
    // Header can render instantly from the list row; messages come from the
    // per-case detail fetch (detail ?? listItem keeps both paths typed).
    const d = (detail ?? listItem)!;
    const msgs = detail?.order.messages ?? [];
    // Plain-language framing of who raised the dispute against whom.
    const buyerIsCryptoBuyerTop = d.order.ad.side === "SELL";
    const orderBuyerName = buyerName(d);
    const merchantName   = d.order.seller.displayName;
    const raiserIsBuyer  = detail?.raisedById === d.order.buyer.id;
    const raiserIsSeller = detail?.raisedById === d.order.seller.userId;
    const raiserName = raiserIsBuyer ? orderBuyerName : raiserIsSeller ? merchantName : null;
    const raiserRole = raiserIsBuyer
      ? (buyerIsCryptoBuyerTop ? "crypto buyer" : "crypto seller")
      : (buyerIsCryptoBuyerTop ? "crypto seller" : "crypto buyer");
    const otherName = raiserIsBuyer ? merchantName : orderBuyerName;
    const otherRole = raiserIsBuyer
      ? (buyerIsCryptoBuyerTop ? "crypto seller" : "crypto buyer")
      : (buyerIsCryptoBuyerTop ? "crypto buyer" : "crypto seller");
    return (
      <div>
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => { setSelectedId(null); setDetail(null); resetTransient(); }}
            className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-xs font-black text-slate-300 transition-colors hover:bg-white/10"
          >
            <Icon name="arrow_back" className="text-base" /> Back
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black ${d.status === "OPEN" ? "border-red-500/20 bg-red-500/10 text-red-400" : "border-[#31c45d]/20 bg-[#31c45d]/10 text-[#31c45d]"}`}>
                {d.status === "OPEN" ? "DISPUTED" : d.status}
              </span>
              <span className="font-mono text-xs text-slate-600">#{d.order.id.slice(0, 12).toUpperCase()}</span>
            </div>
            <p className="mt-0.5 text-sm font-black text-white">
              {Number(d.order.cryptoAmount).toFixed(6)} {d.order.crypto}
              <span className="ml-2 font-medium text-slate-500">· KSh {Number(d.order.fiatAmount).toLocaleString("en-KE")}</span>
            </p>
          </div>
        </div>

        <div className="admin-panel p-5">
              {/* Dispute reason — stated in plain language, up top */}
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
                <p className="mb-1 text-[10px] font-black tracking-wide text-red-400">DISPUTE REASON</p>
                {raiserName && (
                  <p className="mb-1 text-sm font-bold text-white">
                    {raiserName} <span className="font-medium text-slate-400">({raiserRole})</span> raised this against {otherName} <span className="font-medium text-slate-400">({otherRole})</span> · KSh {Number(d.order.fiatAmount).toLocaleString("en-KE")}
                  </p>
                )}
                <p className="text-sm text-slate-300">&ldquo;{d.reason}&rdquo;</p>
              </div>

              {/* Side-by-side: each party's own messages + evidence */}
              {!detail ? (
                <div className="mb-4 flex justify-center py-12"><Spinner /></div>
              ) : (() => {
                const buyerIsCryptoBuyer = d.order.ad.side === "SELL";
                const buyerUserId  = d.order.buyer.id;
                const sellerUserId = d.order.seller.userId;
                const buyerMsgs   = msgs.filter((m) => m.senderId === buyerUserId);
                const sellerMsgs  = msgs.filter((m) => m.senderId === sellerUserId);
                const supportMsgs = msgs.filter((m) => m.senderId !== buyerUserId && m.senderId !== sellerUserId);

                const renderMsgs = (list: typeof msgs) =>
                  list.length === 0
                    ? <p className="px-1 py-2 text-xs italic text-slate-600">No messages yet</p>
                    : list.map((m) => (
                        <div key={m.id} className="w-fit max-w-full rounded-lg bg-white/[0.05] px-3 py-2">
                          <p className="whitespace-pre-wrap break-words text-xs text-slate-300">{m.content}</p>
                          {m.imageUrl && (
                            <a href={m.imageUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#55aaff] underline">
                              <Icon name="image" className="text-xs" /> View attachment
                            </a>
                          )}
                          <p className="mt-1 text-[10px] text-slate-600">{new Date(m.createdAt).toLocaleString("en-KE", { hour12: false })}</p>
                        </div>
                      ));

                const RoleChip = ({ crypto }: { crypto: boolean }) => (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${crypto ? "bg-[#087cff]/15 text-[#75b8ff]" : "bg-[#31c45d]/15 text-[#31c45d]"}`}>
                    {crypto ? "Crypto buyer" : "Crypto seller"}
                  </span>
                );

                return (
                  <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {/* Order buyer column */}
                    <div className="flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
                      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
                        <p className="truncate text-sm font-black text-white">{buyerName(d)}</p>
                        <RoleChip crypto={buyerIsCryptoBuyer} />
                      </div>
                      {(d.evidence || d.order.paymentProofUrl || d.order.paymentRef) && (
                        <div className="border-b border-[#087cff]/15 bg-[#087cff]/[0.06] px-3 py-2">
                          <p className="mb-1 text-[10px] font-black tracking-wide text-[#75b8ff]">PAYMENT EVIDENCE</p>
                          {d.order.paymentRef && <p className="text-[11px] text-slate-300">Ref: {d.order.paymentRef}</p>}
                          {[d.evidence, d.order.paymentProofUrl].filter(Boolean).map((url) => (
                            <a key={url} href={url!} target="_blank" rel="noreferrer" className="mr-3 text-[11px] font-bold text-[#55aaff] underline">Open file</a>
                          ))}
                        </div>
                      )}
                      <div className="space-y-2 p-3">{renderMsgs(buyerMsgs)}</div>
                    </div>

                    {/* Order seller (merchant) column */}
                    <div className="flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
                      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
                        <p className="truncate text-sm font-black text-white">{d.order.seller.displayName}</p>
                        <RoleChip crypto={!buyerIsCryptoBuyer} />
                      </div>
                      <div className="space-y-2 p-3">{renderMsgs(sellerMsgs)}</div>
                    </div>

                    {/* Support / admin messages, full width */}
                    {supportMsgs.length > 0 && (
                      <div className="md:col-span-2 space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
                        <p className="text-[10px] font-black tracking-wide text-amber-400">SUPPORT MESSAGES</p>
                        {supportMsgs.map((m) => (
                          <div key={m.id} className="w-fit max-w-full rounded-lg bg-amber-500/[0.08] px-3 py-2">
                            <p className="whitespace-pre-wrap break-words text-xs text-amber-100/90">{m.content}</p>
                            <p className="mt-1 text-[10px] text-amber-500/60">{new Date(m.createdAt).toLocaleString("en-KE", { hour12: false })}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {resolvingId === d.id ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {(["CRYPTO_BUYER_WINS", "CRYPTO_SELLER_WINS"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setResolution(r)}
                        className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all ${
                          resolution === r
                            ? r === "CRYPTO_BUYER_WINS"
                              ? "bg-[#087cff]/20 border-[#087cff] text-[#087cff]"
                              : "bg-[#31c45d]/20 border-[#31c45d] text-[#31c45d]"
                            : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                        }`}
                      >
                        {r === "CRYPTO_BUYER_WINS" ? "Crypto Buyer Wins" : "Crypto Seller Wins"}
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
              ) : d.status === "OPEN" ? (
                <div className="space-y-2">
                  {proofingId === d.id ? (
                    <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3">
                      <textarea
                        value={proofMsg}
                        onChange={(e) => setProofMsg(e.target.value)}
                        placeholder="Message sent to both parties…"
                        rows={2}
                        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-500/40"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setProofingId(null); setProofMsg(""); }}
                          className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm font-bold text-slate-400 transition-colors hover:bg-white/10"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => requestProof(d.id)}
                          disabled={actionLoading === `proof-${d.id}`}
                          className="flex-1 rounded-xl bg-amber-500/90 py-2.5 text-sm font-black text-black transition-all hover:bg-amber-400 disabled:opacity-50"
                        >
                          {actionLoading === `proof-${d.id}` ? "Sending…" : "Send to both parties"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setProofingId(d.id); setProofMsg(DEFAULT_PROOF_REQUEST); }}
                        className="flex-1 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2.5 text-sm font-black text-amber-400 transition-all hover:bg-amber-500/20"
                      >
                        Request proof
                      </button>
                      <button
                        onClick={() => { setResolvingId(d.id); setResolution(null); setNote(""); }}
                        className="flex-1 rounded-xl bg-[#087cff] py-2.5 text-sm font-black text-white transition-all hover:bg-[#0570e8]"
                      >
                        Resolve Dispute
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Icon name="check_circle" className="text-[#31c45d] text-base" />
                  <span className="text-[#31c45d] text-sm font-bold">Resolved: {d.status}</span>
                </div>
              )}
        </div>
      </div>
    );
  }

  // ───── List view: compact rows, click a row to open the detail ─────
  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(["ALL", "OPEN", "RESOLVED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
              filter === s
                ? s === "OPEN"     ? "bg-red-500/20 text-red-400"
                  : s === "RESOLVED" ? "bg-[#31c45d]/20 text-[#31c45d]"
                  : "bg-[#087cff]/20 text-[#087cff]"
                : "bg-white/5 text-slate-500 hover:text-slate-300"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : disputes.length === 0 ? (
        <div className="admin-panel text-center py-16">
          <Icon name="gavel" className="text-4xl text-slate-700 mb-3" />
          <p className="text-slate-400 font-bold">No {filter === "ALL" ? "" : filter.toLowerCase() + " "}disputes</p>
        </div>
      ) : (
        <div className="admin-panel divide-y divide-white/[0.06] overflow-hidden p-0">
          {disputes.map((d) => {
            const isOpen = d.status === "OPEN";
            return (
              <button
                key={d.id}
                onClick={() => openDispute(d.id)}
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
              >
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-black ${isOpen ? "border-red-500/20 bg-red-500/10 text-red-400" : "border-[#31c45d]/20 bg-[#31c45d]/10 text-[#31c45d]"}`}>
                  {isOpen ? "OPEN" : "RESOLVED"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-600">#{d.order.id.slice(0, 8).toUpperCase()}</span>
                    <span className="truncate text-sm font-black text-white">
                      {buyerName(d)} <span className="font-medium text-slate-600">vs</span> {d.order.seller.displayName}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{d.reason}</p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-sm font-black text-white">KSh {Number(d.order.fiatAmount).toLocaleString("en-KE")}</p>
                  <p className="text-[10px] text-slate-600">{new Date(d.createdAt).toLocaleDateString("en-KE")}</p>
                </div>
                <Icon name="chevron_right" className="shrink-0 text-lg text-slate-600" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Deposits Tab ─────────────────────────────────────────────────────────────

function DepositsTab({ onAction }: { onAction: () => void }) {
  const [filter, setFilter]           = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [deposits, setDeposits]       = useState<AdminDeposit[]>([]);
  const [loading, setLoading]         = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote]   = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedId, setCopiedId]       = useState<string | null>(null);

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === "ALL" ? "/api/admin/p2p/deposits" : `/api/admin/p2p/deposits?status=${filter}`;
      const res = await fetch(url);
      if (res.ok) setDeposits(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [filter]);

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
      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
              filter === s
                ? s === "PENDING"  ? "bg-amber-500/20 text-amber-400"
                  : s === "APPROVED" ? "bg-[#31c45d]/20 text-[#31c45d]"
                  : s === "REJECTED" ? "bg-red-500/20 text-red-400"
                  : "bg-[#087cff]/20 text-[#087cff]"
                : "bg-white/5 text-slate-500 hover:text-slate-300"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : deposits.length === 0 ? (
        <div className="admin-panel text-center py-16">
          <Icon name="south_america" className="text-4xl text-slate-700 mb-3" />
          <p className="text-slate-400 font-bold">No {filter === "ALL" ? "" : filter.toLowerCase() + " "}deposits</p>
        </div>
      ) : (
        <div className="admin-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Merchant", "Asset", "Amount", "TX Hash", "Submitted", "Status", "Actions"].map((h) => (
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
                      {/* Merchant */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="text-white font-black text-sm">{d.merchant.displayName}</p>
                        <p className="text-slate-500 text-[11px] mt-0.5">{(d.merchant as AdminDeposit["merchant"] & { user?: { email?: string | null } }).user?.email ?? ""}</p>
                      </td>
                      {/* Asset */}
                      <td className="px-4 py-3.5">
                        <p className="text-white font-black">{d.crypto}</p>
                        <p className="text-slate-500 text-[11px]">{d.network}</p>
                      </td>
                      {/* Amount */}
                      <td className="px-4 py-3.5">
                        <p className="text-white font-black">{Number(d.amount).toFixed(6)}</p>
                        <p className="text-slate-500 text-[11px]">{d.crypto}</p>
                      </td>
                      {/* TX Hash */}
                      <td className="px-4 py-3.5">
                        {d.txHash ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-slate-400 text-xs">
                              {d.txHash.length > 16 ? `${d.txHash.slice(0, 8)}…${d.txHash.slice(-8)}` : d.txHash}
                            </span>
                            <button
                              onClick={() => copyHash(d.txHash!, d.id)}
                              title="Copy full TX hash"
                              className="text-slate-600 hover:text-[#087cff] transition-colors"
                            >
                              <Icon name={copiedId === d.id ? "check" : "content_copy"} className={`text-[13px] ${copiedId === d.id ? "text-[#31c45d]" : ""}`} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      {/* Submitted */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="text-slate-300 text-xs">{new Date(d.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}</p>
                        <p className="text-slate-600 text-[11px]">{new Date(d.createdAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</p>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <DepositBadge status={d.status} />
                        {d.status !== "PENDING" && (
                          <p className="text-slate-600 text-[10px] mt-1">{d.status === "APPROVED" ? "Credited" : "Declined"}</p>
                        )}
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

// ─── Crypto Wallets Tab ───────────────────────────────────────────────────────

function FamilyBadge({ family }: { family: WalletFamily }) {
  const map: Record<WalletFamily, string> = {
    EVM:  "bg-[#087cff]/10 text-[#087cff] border-[#087cff]/20",
    TRON: "bg-red-500/10 text-red-400 border-red-500/20",
    BTC:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-black ${map[family]}`}>
      {family}
    </span>
  );
}

function CryptoWalletsTab() {
  const [wallets, setWallets]   = useState<CryptoWallet[]>([]);
  const [loading, setLoading]   = useState(true);
  const [copiedAddr, setCopied] = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [familyFilter, setFamilyFilter] = useState<WalletFamily | "ALL">("ALL");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/crypto/wallets");
        if (res.ok) {
          const data = await res.json();
          setWallets(data.wallets ?? []);
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    })();
  }, []);

  function copy(addr: string) {
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(addr);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const filtered = wallets.filter((w) => {
    if (familyFilter !== "ALL" && w.family !== familyFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        w.address.toLowerCase().includes(q) ||
        w.owner.email?.toLowerCase().includes(q) ||
        w.owner.username?.toLowerCase().includes(q) ||
        w.coins.some((c) => c.crypto.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-base pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search address, email, coin…"
            className="w-full pl-9 pr-4 py-2.5 bg-[#0f1623] border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-slate-600 outline-none focus:border-[#087cff]/40"
          />
        </div>
        {/* Family filter */}
        <div className="flex gap-1.5">
          {(["ALL", "EVM", "TRON", "BTC"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFamilyFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${
                familyFilter === f
                  ? f === "EVM"  ? "bg-[#087cff]/20 text-[#087cff]"
                    : f === "TRON" ? "bg-red-500/20 text-red-400"
                    : f === "BTC"  ? "bg-amber-500/20 text-amber-400"
                    : "bg-white/10 text-white"
                  : "bg-white/5 text-slate-500 hover:text-slate-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {/* Total count */}
        {!loading && (
          <span className="text-slate-600 text-xs shrink-0">{filtered.length} address{filtered.length !== 1 ? "es" : ""}</span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="admin-panel text-center py-16">
          <Icon name="account_balance_wallet" className="text-4xl text-slate-700 mb-3" />
          <p className="text-slate-400 font-bold">No deposit addresses found</p>
        </div>
      ) : (
        <div className="admin-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Address", "Network", "Coins", "Owner", "Derivation path", "Created"].map((h) => (
                    <th key={h} className="px-4 py-3.5 text-left text-xs font-black text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((w, i) => (
                  <tr
                    key={w.address}
                    className={`${i < filtered.length - 1 ? "border-b border-white/[0.04]" : ""} hover:bg-white/[0.02] transition-colors`}
                  >
                    {/* Address */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-300 text-xs">
                          {w.address.length > 20
                            ? `${w.address.slice(0, 10)}…${w.address.slice(-8)}`
                            : w.address}
                        </span>
                        <button
                          onClick={() => copy(w.address)}
                          title="Copy full address"
                          className="text-slate-600 hover:text-[#087cff] transition-colors shrink-0"
                        >
                          <Icon
                            name={copiedAddr === w.address ? "check" : "content_copy"}
                            className={`text-[13px] ${copiedAddr === w.address ? "text-[#31c45d]" : ""}`}
                          />
                        </button>
                      </div>
                    </td>
                    {/* Network family */}
                    <td className="px-4 py-3.5">
                      <FamilyBadge family={w.family} />
                    </td>
                    {/* Supported coins */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {w.coins.map((c) => (
                          <span
                            key={`${c.crypto}-${c.network}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/[0.05] text-slate-300 text-[10px] font-bold"
                          >
                            {c.crypto}
                            <span className="text-slate-600 ml-1">{c.network}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    {/* Owner */}
                    <td className="px-4 py-3.5">
                      <p className="text-slate-300 text-xs font-bold">{w.owner.username ?? "—"}</p>
                      <p className="text-slate-600 text-[11px] mt-0.5 truncate max-w-[160px]">{w.owner.email ?? "—"}</p>
                    </td>
                    {/* Derivation path */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-slate-400 text-[11px] bg-white/[0.04] px-2 py-0.5 rounded-md whitespace-nowrap">
                        {w.derivationPath}
                      </span>
                    </td>
                    {/* Created */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="text-slate-400 text-xs">
                        {new Date(w.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recovery footer */}
          <div className="border-t border-white/[0.06] px-5 py-4 bg-amber-500/5">
            <p className="text-amber-400 text-xs font-black mb-2 flex items-center gap-1.5">
              <Icon name="key" className="text-sm" />
              Wallet Recovery (import MASTER_WALLET_MNEMONIC into):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-400">
              <div><span className="text-[#087cff] font-black">EVM</span> — MetaMask → Advanced → HD path <code className="font-mono text-slate-300">m/44&apos;/60&apos;/0&apos;/0</code>, add accounts by index</div>
              <div><span className="text-red-400 font-black">TRON</span> — TronLink → import mnemonic → BIP44 <code className="font-mono text-slate-300">m/44&apos;/195&apos;/0&apos;/0</code></div>
              <div><span className="text-amber-400 font-black">BTC</span> — Electrum → Standard → BIP44 Legacy → <code className="font-mono text-slate-300">m/44&apos;/0&apos;/0&apos;/0</code></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Admin P2P Client ────────────────────────────────────────────────────

type AdminTab = "kyc" | "disputes" | "deposits" | "wallets";

interface PendingCounts { kyc: number; disputes: number; deposits: number }

export function AdminP2PClient() {
  const [tab, setTab]       = useState<AdminTab>("kyc");
  const [counts, setCounts] = useState<PendingCounts>({ kyc: 0, disputes: 0, deposits: 0 });

  const fetchCounts = useCallback(async () => {
    try {
      const [kycRes, disputesRes, depositsRes] = await Promise.all([
        fetch("/api/admin/p2p/merchants?status=PENDING"),
        fetch("/api/admin/p2p/disputes?status=OPEN"),
        fetch("/api/admin/p2p/deposits?status=PENDING"),
      ]);
      const [kyc, disputes, deposits] = await Promise.all([
        kycRes.ok      ? kycRes.json()      : [],
        disputesRes.ok ? disputesRes.json() : [],
        depositsRes.ok ? depositsRes.json() : [],
      ]);
      setCounts({
        kyc:      Array.isArray(kyc)      ? kyc.length      : 0,
        disputes: Array.isArray(disputes) ? disputes.length : 0,
        deposits: Array.isArray(deposits) ? deposits.length : 0,
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const tabs: { id: AdminTab; label: string; icon: string; count: number }[] = [
    { id: "kyc",      label: "KYC Requests",    icon: "verified_user",        count: counts.kyc      },
    { id: "disputes", label: "Disputes",         icon: "gavel",                count: counts.disputes },
    { id: "deposits", label: "Deposits",         icon: "south_america",        count: counts.deposits },
    { id: "wallets",  label: "Crypto Addresses", icon: "account_balance_wallet", count: 0             },
  ];

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[9px] font-black uppercase tracking-[0.24em] text-violet-400">Settlement operations</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white">P2P control desk</h1>
        <p className="mt-1 text-[11px] text-slate-500">Review identities, resolve order disputes, approve deposits and manage settlement wallets.</p>
      </div>

      {/* Tabs */}
      <div className="admin-panel mb-6 flex w-fit max-w-full gap-1 overflow-x-auto p-1.5">
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
      {tab === "kyc"      && <KycRequestsTab  onAction={fetchCounts} />}
      {tab === "disputes" && <DisputesTab     onAction={fetchCounts} />}
      {tab === "deposits" && <DepositsTab     onAction={fetchCounts} />}
      {tab === "wallets"  && <CryptoWalletsTab />}
    </div>
  );
}
