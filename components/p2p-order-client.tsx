"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";
import { P2PSubNav } from "@/components/p2p-subnav";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderData {
  id: string;
  status: "PENDING" | "PAID" | "RELEASED" | "DISPUTED" | "CANCELLED" | "EXPIRED";
  crypto: string;
  cryptoAmount: number;
  fiatAmount: number;
  pricePerUnit: number;
  paymentMethod: string;
  expiresAt: string;
  createdAt: string;
  paidAt: string | null;
  releasedAt: string | null;
  cancelReason: string | null;
  buyer: { id: string; firstName: string | null; lastName: string | null; username: string | null };
  seller: { displayName: string; userId: string };
  ad: { fiat: string; paymentMethods: string[] };
  isBuyer: boolean;
  isSeller: boolean;
}

interface Message {
  id: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  sender: { id: string; firstName: string | null; lastName: string | null; username: string | null; imageUrl: string | null };
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function Countdown({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [secs, setSecs] = useState(0);
  const fired = useRef(false);

  useEffect(() => {
    function update() {
      const diff = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecs(diff);
      if (diff === 0 && !fired.current) {
        fired.current = true;
        onExpire();
      }
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const urgent = secs < 120;

  return (
    <div className={`flex items-center gap-2 font-mono font-black text-xl tabular-nums ${urgent ? "text-red-400" : "text-white"}`}>
      <Icon name="timer" className={`text-lg ${urgent ? "text-red-400" : "text-slate-400"}`} />
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrderData["status"] }) {
  const map: Record<OrderData["status"], { label: string; color: string }> = {
    PENDING:   { label: "Awaiting Payment", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    PAID:      { label: "Payment Sent",     color: "text-[#087cff] bg-[#087cff]/10 border-[#087cff]/20" },
    RELEASED:  { label: "Completed",        color: "text-[#31c45d] bg-[#31c45d]/10 border-[#31c45d]/20" },
    DISPUTED:  { label: "In Dispute",       color: "text-red-400 bg-red-500/10 border-red-500/20" },
    CANCELLED: { label: "Cancelled",        color: "text-slate-400 bg-white/5 border-white/10" },
    EXPIRED:   { label: "Expired",          color: "text-slate-500 bg-white/5 border-white/10" },
  };
  const { label, color } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${color}`}>
      {status === "PENDING" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
      {label}
    </span>
  );
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

function Chat({ orderId, currentUserId, closed }: { orderId: string; currentUserId: string; closed: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/p2p/orders/${orderId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch { /* ignore */ }
  }, [orderId]);

  useEffect(() => {
    fetchMessages();

    const supabase = createClient();
    const channel = supabase
      .channel(`p2p-order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "p2p_messages",
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchMessages, orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/p2p/orders/${orderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setInput("");
      await fetchMessages();
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function senderName(s: Message["sender"]) {
    return s.firstName ? `${s.firstName} ${s.lastName ?? ""}`.trim() : s.username ?? "User";
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <Icon name="chat_bubble_outline" className="text-3xl text-slate-700 mb-2" />
            <p className="text-slate-600 text-sm">No messages yet.<br />Chat with the merchant here.</p>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender.id === currentUserId;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#087cff] to-[#31c45d] flex items-center justify-center text-white text-[10px] font-black shrink-0">
                {senderName(m.sender).charAt(0).toUpperCase()}
              </div>
              <div className={`max-w-[70%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                <span className="text-slate-600 text-[10px] font-medium">{senderName(m.sender)}</span>
                <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  mine ? "bg-[#087cff] text-white rounded-tr-sm" : "bg-white/8 text-slate-200 rounded-tl-sm"
                }`}>
                  {m.content}
                </div>
                <span className="text-slate-700 text-[10px]">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!closed && (
        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Type a message…"
              className="flex-1 bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none border border-white/[0.06] focus:border-[#087cff]/40"
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="w-10 h-10 rounded-xl bg-[#087cff] flex items-center justify-center text-white disabled:opacity-40 hover:bg-[#0570e8] transition-colors shrink-0"
            >
              {sending
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Icon name="send" className="text-base" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Order Page ──────────────────────────────────────────────────────────

export function P2POrderClient({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { user } = useSupabaseAuth();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

  // Action states
  const [paidRef, setPaidRef] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/p2p/orders/${orderId}`);
      if (res.ok) setOrder(await res.json());
      else if (res.status === 404) router.push("/p2p");
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    fetchOrder();
    const id = setInterval(fetchOrder, 10000);
    return () => clearInterval(id);
  }, [fetchOrder]);

  async function doAction(endpoint: string, body: object, label: string) {
    setActionLoading(label);
    try {
      const res = await fetch(`/api/p2p/orders/${orderId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      await fetchOrder();
      toast.success(`Order ${data.status?.toLowerCase()}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-white/10 border-t-[#087cff] rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  const isClosed = ["RELEASED", "CANCELLED", "EXPIRED"].includes(order.status);
  const currentUserId = user?.id ?? ""; // supabase user id — note: may differ from dbUser.id

  return (
    <>
      <P2PSubNav />
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Back */}
      <button
        onClick={() => router.push("/p2p/orders")}
        className="flex items-center gap-1.5 text-slate-500 hover:text-white text-sm font-bold mb-6 transition-colors"
      >
        <Icon name="arrow_back" className="text-base" />
        Back to P2P
      </button>

      {/* Order header */}
      <div className="bg-[#0f1623] border border-white/[0.06] rounded-2xl p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-white font-black text-lg">
                {order.isBuyer ? "Buy" : "Sell"} {order.crypto}
              </h1>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-slate-500 text-xs font-mono">#{orderId.slice(0, 16).toUpperCase()}</p>
          </div>
          {/* Countdown — only for PENDING */}
          {order.status === "PENDING" && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-slate-600 text-xs font-medium">Time remaining</span>
              <Countdown
                expiresAt={order.expiresAt}
                onExpire={fetchOrder}
              />
            </div>
          )}
        </div>

        {/* Trade details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-slate-600 text-xs mb-0.5">Amount</p>
            <p className="text-white font-black text-base">{Number(order.cryptoAmount).toFixed(6)} {order.crypto}</p>
          </div>
          <div>
            <p className="text-slate-600 text-xs mb-0.5">Price</p>
            <p className="text-white font-bold">{Number(order.pricePerUnit).toLocaleString("en-KE")} {order.ad.fiat}</p>
          </div>
          <div>
            <p className="text-slate-600 text-xs mb-0.5">You {order.isBuyer ? "pay" : "receive"}</p>
            <p className="text-[#31c45d] font-black text-base">KSh {Number(order.fiatAmount).toLocaleString("en-KE")}</p>
          </div>
          <div>
            <p className="text-slate-600 text-xs mb-0.5">Payment</p>
            <p className="text-white font-bold">
              {order.paymentMethod === "MPESA" ? "M-Pesa" : order.paymentMethod === "BANK" ? "Bank Transfer" : order.paymentMethod}
            </p>
          </div>
        </div>

        {/* Parties */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Icon name="person" className="text-slate-600 text-sm" />
            <span className="text-slate-500 text-xs">Buyer:</span>
            <span className="text-slate-300 text-xs font-bold">
              {order.buyer.firstName ? `${order.buyer.firstName} ${order.buyer.lastName ?? ""}`.trim() : order.buyer.username ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="storefront" className="text-slate-600 text-sm" />
            <span className="text-slate-500 text-xs">Merchant:</span>
            <span className="text-slate-300 text-xs font-bold">{order.seller.displayName}</span>
          </div>
        </div>
      </div>

      {/* Two-column layout: actions + chat */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">

        {/* LEFT: Instructions + Actions */}
        <div className="space-y-4">

          {/* Instructions card */}
          {!isClosed && (
            <div className="bg-[#0f1623] border border-white/[0.06] rounded-2xl p-5">
              <h2 className="text-white font-black mb-3">
                {order.status === "PENDING" && order.isBuyer && "How to complete your order"}
                {order.status === "PENDING" && order.isSeller && "Waiting for buyer to pay"}
                {order.status === "PAID" && order.isBuyer && "Payment sent — waiting for release"}
                {order.status === "PAID" && order.isSeller && "Verify the payment and release"}
                {order.status === "DISPUTED" && "Dispute in progress"}
              </h2>

              {order.status === "PENDING" && order.isBuyer && (
                <ol className="space-y-3 text-sm text-slate-400">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#087cff]/20 text-[#087cff] text-xs font-black flex items-center justify-center shrink-0">1</span>
                    <span>Send <span className="text-white font-bold">KSh {Number(order.fiatAmount).toLocaleString("en-KE")}</span> to the merchant via <span className="text-white font-bold">{order.paymentMethod === "MPESA" ? "M-Pesa" : "Bank Transfer"}</span>.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#087cff]/20 text-[#087cff] text-xs font-black flex items-center justify-center shrink-0">2</span>
                    <span>Enter your M-Pesa transaction code or reference below, then click <strong className="text-white">I&apos;ve Paid</strong>.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#087cff]/20 text-[#087cff] text-xs font-black flex items-center justify-center shrink-0">3</span>
                    <span>The merchant will verify and release your crypto within minutes.</span>
                  </li>
                </ol>
              )}

              {order.status === "PENDING" && order.isSeller && (
                <p className="text-slate-400 text-sm leading-relaxed">
                  Wait for the buyer to complete payment. You will be notified when they mark it as paid.
                  Do <strong className="text-white">not</strong> release crypto until you verify the payment in your account.
                </p>
              )}

              {order.status === "PAID" && order.isSeller && (
                <ol className="space-y-3 text-sm text-slate-400">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#31c45d]/20 text-[#31c45d] text-xs font-black flex items-center justify-center shrink-0">1</span>
                    <span>Check your <strong className="text-white">{order.paymentMethod === "MPESA" ? "M-Pesa" : "Bank"}</strong> for a payment of <strong className="text-white">KSh {Number(order.fiatAmount).toLocaleString("en-KE")}</strong>.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#31c45d]/20 text-[#31c45d] text-xs font-black flex items-center justify-center shrink-0">2</span>
                    <span>Once confirmed, click <strong className="text-white">Release Crypto</strong> to complete the trade.</span>
                  </li>
                </ol>
              )}

              {order.status === "PAID" && order.isBuyer && (
                <p className="text-slate-400 text-sm leading-relaxed">
                  Your payment has been recorded. The merchant is verifying it now.
                  If they don&apos;t release within a reasonable time, you can raise a dispute.
                </p>
              )}

              {order.status === "DISPUTED" && (
                <p className="text-slate-400 text-sm leading-relaxed">
                  This trade is under review. Our team will investigate and resolve it within 24 hours.
                  Please provide any additional evidence via the chat.
                </p>
              )}
            </div>
          )}

          {/* Closed state summary */}
          {isClosed && (
            <div className={`rounded-2xl p-5 border ${
              order.status === "RELEASED"
                ? "bg-[#31c45d]/5 border-[#31c45d]/20"
                : "bg-white/5 border-white/10"
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <Icon
                  name={order.status === "RELEASED" ? "check_circle" : "cancel"}
                  className={`text-2xl ${order.status === "RELEASED" ? "text-[#31c45d]" : "text-slate-500"}`}
                />
                <h2 className="text-white font-black text-lg">
                  {order.status === "RELEASED" ? "Trade Completed!" : order.status === "CANCELLED" ? "Order Cancelled" : "Order Expired"}
                </h2>
              </div>
              {order.status === "RELEASED" && (
                <p className="text-slate-400 text-sm">
                  <strong className="text-[#31c45d]">{Number(order.cryptoAmount).toFixed(6)} {order.crypto}</strong> has been released successfully.
                </p>
              )}
              {order.cancelReason && (
                <p className="text-slate-500 text-sm mt-2">Reason: {order.cancelReason}</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          {!isClosed && (
            <div className="bg-[#0f1623] border border-white/[0.06] rounded-2xl p-5 space-y-4">

              {/* Buyer: I've Paid */}
              {order.isBuyer && order.status === "PENDING" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 mb-1.5 block">
                      Transaction reference (optional)
                    </label>
                    <input
                      type="text"
                      value={paidRef}
                      onChange={(e) => setPaidRef(e.target.value)}
                      placeholder="e.g. QHJ2K3L9M — M-Pesa confirmation code"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-[#087cff]/40"
                    />
                  </div>
                  <button
                    onClick={() => doAction("paid", { paymentRef: paidRef || null }, "paid")}
                    disabled={!!actionLoading}
                    className="w-full py-3 rounded-xl font-black text-white bg-[#087cff] hover:bg-[#0570e8] disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    {actionLoading === "paid"
                      ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Confirming…</span>
                      : "✓ I've Paid"}
                  </button>
                </div>
              )}

              {/* Seller: Release */}
              {order.isSeller && order.status === "PAID" && (
                <button
                  onClick={() => doAction("release", {}, "release")}
                  disabled={!!actionLoading}
                  className="w-full py-3 rounded-xl font-black text-white bg-[#31c45d] hover:bg-[#28af52] disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {actionLoading === "release"
                    ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Releasing…</span>
                    : `Release ${Number(order.cryptoAmount).toFixed(6)} ${order.crypto}`}
                </button>
              )}

              {/* Buyer: Dispute (only after PAID) */}
              {order.isBuyer && order.status === "PAID" && (
                <>
                  {showDisputeForm ? (
                    <div className="space-y-3">
                      <textarea
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        placeholder="Describe the issue in detail…"
                        rows={3}
                        className="w-full bg-white/5 border border-red-500/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowDisputeForm(false)}
                          className="flex-1 py-2.5 rounded-xl font-bold text-slate-400 bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (!disputeReason.trim()) return toast.error("Please describe the issue");
                            doAction("dispute", { reason: disputeReason }, "dispute").then(() => setShowDisputeForm(false));
                          }}
                          disabled={!disputeReason.trim() || !!actionLoading}
                          className="flex-1 py-2.5 rounded-xl font-black text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === "dispute" ? "Raising…" : "Raise Dispute"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDisputeForm(true)}
                      className="w-full py-2.5 rounded-xl font-bold text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors text-sm"
                    >
                      Raise Dispute
                    </button>
                  )}
                </>
              )}

              {/* Cancel — only PENDING */}
              {order.status === "PENDING" && (order.isBuyer || order.isSeller) && (
                <>
                  {showCancelForm ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Reason for cancelling (optional)"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowCancelForm(false)}
                          className="flex-1 py-2.5 rounded-xl font-bold text-slate-400 bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          Keep Order
                        </button>
                        <button
                          onClick={() => doAction("cancel", { reason: cancelReason || null }, "cancel").then(() => setShowCancelForm(false))}
                          disabled={!!actionLoading}
                          className="flex-1 py-2.5 rounded-xl font-black text-slate-300 bg-white/10 hover:bg-white/15 disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === "cancel" ? "Cancelling…" : "Confirm Cancel"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCancelForm(true)}
                      className="w-full py-2 rounded-xl font-medium text-slate-600 hover:text-slate-400 transition-colors text-sm"
                    >
                      Cancel Order
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Chat */}
        <div className="bg-[#0f1623] border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: "420px" }}>
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <Icon name="chat" className="text-slate-500 text-base" />
            <span className="text-slate-300 font-bold text-sm">Order Chat</span>
            {!isClosed && (
              <span className="ml-auto w-2 h-2 rounded-full bg-[#31c45d] animate-pulse" title="Live" />
            )}
          </div>
          <div className="flex-1 min-h-0">
            <Chat orderId={orderId} currentUserId={currentUserId} closed={isClosed} />
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
