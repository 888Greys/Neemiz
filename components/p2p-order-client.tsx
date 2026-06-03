"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";
import { P2PSubNav } from "@/components/p2p-subnav";
import { formatFiat } from "@/lib/p2p/currencies";
import { P2PStatusBadge } from "@/components/p2p/status-badge";
import { LoadingDots } from "@/components/loading-dots";
import { paymentMethodLabel } from "@/lib/p2p/payment-methods";

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
  seller: {
    displayName: string;
    userId: string;
    paymentMethod: { type: string; accountName: string; accountNo: string; bankName: string | null; name: string } | null;
  };
  ad: { fiat: string; paymentMethods: string[] };
  side: "BUY" | "SELL";
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
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
  }, [orderId]);

  useEffect(() => {
    fetchMessages();

    // Poll every 4s as a reliable fallback (realtime requires DB replication enabled)
    const poll = setInterval(fetchMessages, 4000);

    // Unique channel name per mount — the desktop and mobile-overlay Chat can be
    // mounted simultaneously, and subscribing two channels with the same topic on
    // the shared browser client throws "subscribe multiple times" (which, thrown
    // inside this effect, would blank the whole page). The poll covers realtime
    // either way, so wrap setup defensively.
    let cleanup = () => {};
    try {
      const supabase = createClient();
      const channel = supabase
        .channel(`p2p-order-${orderId}-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "p2p_messages",
            filter: `order_id=eq.${orderId}`,
          },
          () => { fetchMessages(); }
        )
        .subscribe();
      cleanup = () => { supabase.removeChannel(channel); };
    } catch { /* realtime unavailable — poll still works */ }

    return () => {
      clearInterval(poll);
      cleanup();
    };
  }, [fetchMessages, orderId]);

  const prevMsgCount = useRef(0);
  useEffect(() => {
    // Only scroll when a NEW message actually arrives. The 4s poll re-sets
    // `messages` to a fresh array every time, which previously fired
    // scrollIntoView on every tick and yanked the whole page. block:"nearest"
    // also keeps it from moving the window when the chat is already in view.
    if (messages.length > prevMsgCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    prevMsgCount.current = messages.length;
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

  function senderName(s: Message["sender"] | null | undefined) {
    if (!s) return "User";
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
          const mine = m.sender?.id === currentUserId;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#087cff] to-[#05b957] flex items-center justify-center text-white text-[10px] font-black shrink-0">
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

function MobileP2POrderView({
  order,
  orderId,
  paidRef,
  setPaidRef,
  actionLoading,
  onBack,
  onAction,
}: {
  order: OrderData;
  orderId: string;
  paidRef: string;
  setPaidRef: (value: string) => void;
  actionLoading: string | null;
  onBack: () => void;
  onAction: (endpoint: string, body: object, label: string) => Promise<void>;
}) {
  const [showChat, setShowChat] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [mobileCancelReason, setMobileCancelReason] = useState("");
  const [showDisputeScreen, setShowDisputeScreen] = useState(false);
  const [mobileDisputeReason, setMobileDisputeReason] = useState("");

  const merchantIsSelling = order.side === "SELL";
  const paymentName = paymentMethodLabel(order.paymentMethod);
  const canMarkPaid = order.isBuyer && order.status === "PENDING" && merchantIsSelling;
  const currentUserId = order.isBuyer ? order.buyer.id : order.seller.userId;
  const orderClosed = ["RELEASED", "CANCELLED", "EXPIRED", "DISPUTED"].includes(order.status);

  // ── Chat overlay ──────────────────────────────────────────────────────────
  if (showChat) {
    return (
      <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-[#08080c] text-white">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#1e1e30] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => setShowChat(false)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
          >
            <Icon name="arrow_back" className="text-[21px]" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{order.seller.displayName}</p>
            <p className="text-[11px] text-slate-500">Order #{orderId.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
        {/* Chat body */}
        <div className="flex-1 min-h-0">
          <Chat orderId={orderId} currentUserId={currentUserId} closed={orderClosed} />
        </div>
      </div>
    );
  }

  // ── Cancel confirmation screen ────────────────────────────────────────────
  if (showCancelForm) {
    return (
      <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-[#08080c] text-white">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#1e1e30] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => setShowCancelForm(false)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
          >
            <Icon name="arrow_back" className="text-[21px]" />
          </button>
          <h1 className="text-sm font-black">Cancel Order</h1>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-[12px] font-bold leading-5 text-red-400">
              Are you sure you want to cancel this order? This action cannot be undone.
            </p>
          </div>
          <label className="mb-2 block text-[11px] font-bold text-slate-500">Reason for cancellation (optional)</label>
          <textarea
            value={mobileCancelReason}
            onChange={(e) => setMobileCancelReason(e.target.value)}
            placeholder="e.g. Payment method not supported, changed my mind…"
            rows={4}
            className="w-full rounded-xl border border-white/[0.08] bg-[#16161f] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-700 resize-none"
          />
        </div>

        {/* Footer action */}
        <div className="border-t border-[#1e1e30] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={!!actionLoading}
            onClick={async () => {
              await onAction("cancel", { reason: mobileCancelReason || null }, "cancel");
              setShowCancelForm(false);
            }}
            className="h-12 w-full rounded-full bg-red-500 text-sm font-black text-white disabled:opacity-50 hover:bg-red-600 transition-colors"
          >
            {actionLoading === "cancel" ? "Cancelling…" : "Confirm Cancel"}
          </button>
        </div>
      </div>
    );
  }

  // ── Dispute screen ───────────────────────────────────────────────────────
  if (showDisputeScreen) {
    return (
      <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-[#08080c] text-white">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#1e1e30] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => setShowDisputeScreen(false)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
          >
            <Icon name="arrow_back" className="text-[21px]" />
          </button>
          <h1 className="text-sm font-black">Raise a Dispute</h1>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-[12px] font-bold leading-5 text-red-400">
              Only raise a dispute if you have paid and the merchant is not responding or refusing to release.
              Our team will review within 24 hours.
            </p>
          </div>
          <label className="mb-2 block text-[11px] font-bold text-slate-500">Describe the issue</label>
          <textarea
            value={mobileDisputeReason}
            onChange={(e) => setMobileDisputeReason(e.target.value)}
            placeholder="e.g. I paid KSh 5,000 via M-Pesa (ref: QHJ2K3L) 30 minutes ago but merchant has not released…"
            rows={6}
            className="w-full rounded-xl border border-white/[0.08] bg-[#16161f] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-700 resize-none"
          />
        </div>

        {/* Footer action */}
        <div className="border-t border-[#1e1e30] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={!mobileDisputeReason.trim() || !!actionLoading}
            onClick={async () => {
              if (!mobileDisputeReason.trim()) return;
              await onAction("dispute", { reason: mobileDisputeReason.trim() }, "dispute");
              setShowDisputeScreen(false);
              setMobileDisputeReason("");
            }}
            className="h-12 w-full rounded-full bg-red-500 text-sm font-black text-white disabled:opacity-50 hover:bg-red-600 transition-colors"
          >
            {actionLoading === "dispute" ? "Raising dispute…" : "Submit Dispute"}
          </button>
        </div>
      </div>
    );
  }

  // ── Terminal state screen (Completed / Cancelled / Expired) ─────────────
  if (["RELEASED", "CANCELLED", "EXPIRED"].includes(order.status)) {
    const isSuccess = order.status === "RELEASED";
    const isCancelled = order.status === "CANCELLED";
    const paymentLabel = paymentMethodLabel(order.paymentMethod);
    const rows = [
      { label: "Amount",            value: formatFiat(Number(order.fiatAmount), order.ad.fiat, { decimals: 2 }) },
      { label: "Price",             value: formatFiat(Number(order.pricePerUnit), order.ad.fiat) },
      { label: "Total Quantity",    value: `${Number(order.cryptoAmount).toFixed(6)} ${order.crypto}` },
      { label: "Transaction Fees",  value: `0 ${order.crypto}` },
      { label: "Order No.",         value: orderId.slice(0, 20).toUpperCase(), copy: true },
      { label: "Order Time",        value: new Date(order.createdAt).toLocaleString("en-KE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) },
    ];

    return (
      <div className="lg:hidden flex flex-col min-h-[calc(100dvh-7rem)] bg-[#08080c] text-white">
        {/* Top bar */}
        <div className="grid grid-cols-[36px_1fr_36px] items-center border-b border-white/[0.08] px-4 pb-3 pt-3">
          <button type="button" onClick={onBack} className="grid h-9 w-9 place-items-center rounded-full text-white">
            <Icon name="arrow_back" className="text-[21px]" />
          </button>
          <span className="text-center text-sm font-black">P2P Help Center</span>
          <div />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(3rem+env(safe-area-inset-bottom))]">
          {/* Title */}
          <h1 className="mb-4 text-[20px] font-black leading-snug">
            {isSuccess ? "Trade completed!" : isCancelled ? "Your order has been canceled." : "Your order has expired."}
          </h1>

          {/* Info box */}
          {!isSuccess && (
            <div className="mb-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
              <p className="text-[12px] leading-5 text-slate-400">
                This order has concluded, and the assets are no longer locked in escrow. Do not blindly trust strangers or release funds without confirming.
              </p>
            </div>
          )}
          {!isSuccess && (
            <p className="mb-4 text-[12px] leading-5 text-slate-500">
              {order.cancelReason
                ? order.cancelReason
                : isCancelled
                ? "Your order has been cancelled by the system because you didn't indicate that you made the payment before the countdown timer ended."
                : "Your order expired because the payment window closed without a confirmed payment."}
            </p>
          )}
          {isSuccess && (
            <div className="mb-4 rounded-xl border border-[#05b957]/20 bg-[#05b957]/5 px-4 py-3">
              <p className="text-[11px] text-slate-500">{order.isBuyer ? "You received" : "You sent"}</p>
              <p className="mt-0.5 text-[26px] font-black text-[#05b957] tabular-nums">
                {Number(order.cryptoAmount).toFixed(6)} <span className="text-[16px]">{order.crypto}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">≈ {formatFiat(Number(order.fiatAmount), order.ad.fiat, { decimals: 2 })}</p>
            </div>
          )}

          {/* Merchant + contact */}
          <div className="mb-4 flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#16161f] px-4 py-3">
            <button type="button" className="flex items-center gap-1 text-sm font-bold text-white">
              {order.seller.displayName} <Icon name="chevron_right" className="text-[16px] text-slate-500" />
            </button>
            <button type="button" onClick={() => setShowChat(true)} className="rounded-full bg-[#f59e0b] px-4 py-1.5 text-xs font-black text-black hover:bg-[#f59e0b]/80 transition-colors">
              Contact Seller
            </button>
          </div>

          {/* Order type chip */}
          <div className="mb-4">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-black ${
              order.isBuyer ? "bg-[#05b957]/15 text-[#05b957]" : "bg-red-500/15 text-red-400"
            }`}>
              <Icon name={order.isBuyer ? "arrow_downward" : "arrow_upward"} className="text-[12px]" />
              {order.isBuyer ? "Buy" : "Sell"} {order.crypto}
            </span>
          </div>

          {/* Details table */}
          <div className="mb-4 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0e0e14] divide-y divide-white/[0.05]">
            {rows.map(({ label, value, copy }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <span className="text-[12px] text-slate-500">{label}</span>
                <span className="flex items-center gap-1.5 text-right text-[12px] font-bold text-white">
                  {value}
                  {copy && <Icon name="content_copy" className="text-[12px] text-slate-500" />}
                </span>
              </div>
            ))}
          </div>

          {/* Payment method */}
          <div className="mb-5 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0e0e14]">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[12px] text-slate-500">Payment Method</span>
              <Icon name="keyboard_arrow_down" className="text-[18px] text-slate-500" />
            </div>
            <div className="border-t border-white/[0.05] px-4 py-3">
              <span className="flex items-center gap-1.5 text-[12px] font-bold text-white">
                <span className={`h-3.5 w-0.5 rounded-full ${order.paymentMethod === "MPESA" ? "bg-[#05b957]" : "bg-[#f59e0b]"}`} />
                {paymentLabel}
              </span>
            </div>
          </div>

          {/* Bottom actions */}
          <button
            type="button"
            className="mb-3 h-12 w-full rounded-xl border border-white/[0.10] bg-[#16161f] text-sm font-black text-white"
          >
            Order Dispute?
          </button>
          <button type="button" className="w-full text-center text-sm font-bold text-[#087cff]">
            Encountered an Issue?
          </button>
        </div>
      </div>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────
  return (
    <div className="lg:hidden min-h-[calc(100dvh-7rem)] bg-[#08080c] px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-3 text-white">
      <div className="mb-4 grid grid-cols-[36px_minmax(0,1fr)_auto] items-center border-b border-white/[0.08] pb-3">
        <button type="button" onClick={onBack} className="grid h-9 w-9 place-items-center rounded-full text-white">
          <Icon name="arrow_back" className="text-[21px]" />
        </button>
        <div />
        {order.status === "PENDING" && (
          <button
            type="button"
            onClick={() => setShowCancelForm(true)}
            className="text-xs font-semibold text-slate-400 hover:text-red-400 transition-colors"
          >
            Cancel Order
          </button>
        )}
      </div>

      <h1 className="mb-2 text-[20px] font-black">
        {order.status === "PENDING" ? "Pending for Payment" : order.status === "PAID" ? "Payment Sent" : order.status}
      </h1>
      {order.status === "PENDING" && (
        <div className="mb-5 text-[12px] font-bold leading-4 text-red-500">
          <p>Note: The order will be automatically cancelled if the button is not clicked by the deadline.</p>
          <div className="mt-1 scale-75 origin-left">
            <Countdown expiresAt={order.expiresAt} onExpire={() => {}} />
          </div>
        </div>
      )}

      <div className="mb-5 flex items-center justify-between rounded-2xl bg-[#16161f] px-4 py-3">
        <button type="button" className="flex items-center gap-1 text-sm font-bold text-white">
          {order.seller.displayName}
          <Icon name="chevron_right" className="text-[16px] text-slate-500" />
        </button>
        <button
          type="button"
          onClick={() => setShowChat(true)}
          className="rounded-full bg-[#087cff] px-4 py-2 text-xs font-black text-white hover:bg-[#0570e8] transition-colors"
        >
          Contact Seller
        </button>
      </div>

      <section className="mb-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-[#087cff]/30 bg-[#087cff]/15 text-[11px] font-black text-[#087cff]">1</span>
          <h2 className="text-sm font-black">Transfer via {paymentName}</h2>
        </div>
        <div className="ml-2 border-l border-white/[0.10] pl-4">
          <InfoRow label="Fiat Amount" value={formatFiat(Number(order.fiatAmount), order.ad.fiat, { decimals: 2 })} copy />
          <InfoRow label="Account Name" value={order.seller.paymentMethod?.accountName ?? order.seller.displayName.toUpperCase()} copy />
          <InfoRow
            label={order.paymentMethod === "MPESA" ? "Paybill / Phone No." : order.seller.paymentMethod?.bankName ? `${order.seller.paymentMethod.bankName} Account` : "Account Number"}
            value={order.seller.paymentMethod?.accountNo ?? "—"}
            copy={!!order.seller.paymentMethod?.accountNo}
          />
          {order.seller.paymentMethod?.bankName && (
            <InfoRow label="Bank" value={order.seller.paymentMethod.bankName} />
          )}
          <InfoRow label="Order No." value={orderId.slice(0, 24).toUpperCase()} copy />
          <button type="button" className="mt-2 flex items-center gap-1 text-xs text-slate-500">
            Order details
            <Icon name="chevron_right" className="text-[14px]" />
          </button>
          <p className="mt-3 text-[11px] leading-4 text-slate-500">
            Follow the payment instructions displayed on the order page. If any payment details appear unclear, do not proceed with the payment and cancel the order instead.
          </p>
        </div>
      </section>

      <section className="mb-5">
        <div className="mb-3 flex items-start gap-2">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#087cff]/30 bg-[#087cff]/15 text-[11px] font-black text-[#087cff]">2</span>
          <h2 className="text-sm font-black">After payment, click the button below so the seller can release the crypto.</h2>
        </div>
        <div className="ml-7 space-y-1 text-[11px] leading-4 text-slate-500">
          <p>1. Always use a payment account that matches your verified name.</p>
          <p>2. Do not split the payment into multiple transactions unless requested by the seller.</p>
          <p>3. Real-time payment is strongly recommended.</p>
        </div>
      </section>

      {canMarkPaid && (
        <div className="mb-4">
          <label className="mb-1.5 block text-[11px] font-bold text-slate-500">Transaction reference optional</label>
          <input
            value={paidRef}
            onChange={(e) => setPaidRef(e.target.value)}
            placeholder="M-Pesa confirmation code"
            className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#16161f] px-3 text-sm text-white outline-none placeholder:text-slate-700"
          />
        </div>
      )}

      {order.status === "PAID" && order.isBuyer && merchantIsSelling && (
        <button
          type="button"
          onClick={() => setShowDisputeScreen(true)}
          className="mb-5 flex w-full items-center justify-between rounded-2xl bg-red-500/5 border border-red-500/20 px-4 py-3 text-left hover:bg-red-500/10 transition-colors"
        >
          <span className="flex items-center gap-2 text-xs text-red-400 font-bold">
            <Icon name="gavel" className="text-[16px]" />
            Merchant not releasing? Raise a dispute
          </span>
          <Icon name="chevron_right" className="text-[16px] text-red-500/50" />
        </button>
      )}

      {order.status !== "PAID" && (
        <button type="button" className="mb-5 flex w-full items-center justify-between rounded-2xl bg-[#16161f] px-4 py-3 text-left">
          <span className="flex items-center gap-2 text-xs text-white">
            <Icon name="tips_and_updates" className="text-[16px] text-[#f59e0b]" />
            Encountered an issue?
          </span>
          <Icon name="chevron_right" className="text-[16px] text-slate-500" />
        </button>
      )}

      <div className="fixed bottom-14 left-0 right-0 z-40 border-t border-[#1e1e30] bg-[#08080c] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        {canMarkPaid && (
          <button
            type="button"
            disabled={!!actionLoading}
            onClick={() => onAction("paid", { paymentRef: paidRef || null }, "paid")}
            className="h-12 w-full rounded-full bg-[#087cff] text-sm font-black text-white disabled:opacity-50 hover:bg-[#0570e8] transition-colors"
          >
            {actionLoading === "paid" ? "Confirming..." : "Payment Completed"}
          </button>
        )}
        {order.status === "PAID" && order.isSeller && merchantIsSelling && (
          <button
            type="button"
            disabled={!!actionLoading}
            onClick={() => onAction("release", {}, "release")}
            className="h-12 w-full rounded-full bg-[#05b957] text-sm font-black text-white disabled:opacity-50 hover:bg-[#28af52] transition-colors"
          >
            {actionLoading === "release" ? "Releasing…" : `Release ${Number(order.cryptoAmount).toFixed(6)} ${order.crypto}`}
          </button>
        )}
        {order.status === "PAID" && order.isBuyer && !merchantIsSelling && (
          <button
            type="button"
            disabled={!!actionLoading}
            onClick={() => onAction("release", {}, "release")}
            className="h-12 w-full rounded-full bg-[#05b957] text-sm font-black text-white disabled:opacity-50 hover:bg-[#28af52] transition-colors"
          >
            {actionLoading === "release" ? "Releasing…" : `Release ${Number(order.cryptoAmount).toFixed(6)} ${order.crypto}`}
          </button>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, copy = false }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <span className="text-[12px] text-slate-500">{label}</span>
      <span className="flex items-center gap-1 text-right text-[12px] font-bold text-white">
        {value}
        {copy && <Icon name="content_copy" className="text-[13px] text-slate-400" />}
      </span>
    </div>
  );
}

// ─── Main Order Page ──────────────────────────────────────────────────────────

export function P2POrderClient({ orderId }: { orderId: string }) {
  const router = useRouter();
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
  const merchantIsSelling = order.side === "SELL";
  // Use dbUser IDs (CUIDs) — not the Supabase auth UUID — so the Chat "mine" check matches sender.id
  const currentUserId = order.isBuyer ? order.buyer.id : order.seller.userId;

  return (
    <>
      <P2PSubNav />
      <MobileP2POrderView
        order={order}
        orderId={orderId}
        paidRef={paidRef}
        setPaidRef={setPaidRef}
        actionLoading={actionLoading}
        onBack={() => router.push("/p2p/orders")}
        onAction={doAction}
      />
    <div className="hidden max-w-5xl mx-auto px-4 py-6 lg:block">
      {/* Back */}
      <button
        onClick={() => router.push("/p2p/orders")}
        className="flex items-center gap-1.5 text-slate-500 hover:text-white text-sm font-bold mb-6 transition-colors"
      >
        <Icon name="arrow_back" className="text-base" />
        Back to P2P
      </button>

      {/* Order header */}
      <div className="bg-[#111118] border border-white/[0.06] rounded-2xl p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-white font-black text-lg">
                {order.isBuyer ? "Buy" : "Sell"} {order.crypto}
              </h1>
              <P2PStatusBadge status={order.status} size="md" detailed />
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
            <p className="text-white font-bold">{formatFiat(Number(order.pricePerUnit), order.ad.fiat)}</p>
          </div>
          <div>
            <p className="text-slate-600 text-xs mb-0.5">You {order.isBuyer ? "pay" : "receive"}</p>
            <p className="text-[#05b957] font-black text-base">{formatFiat(Number(order.fiatAmount), order.ad.fiat)}</p>
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
            <div className="bg-[#111118] border border-white/[0.06] rounded-2xl p-5">
              <h2 className="text-white font-black mb-3">
                {order.status === "PENDING" && order.isBuyer && merchantIsSelling && "How to complete your order"}
                {order.status === "PENDING" && order.isBuyer && !merchantIsSelling && "Waiting for merchant payment"}
                {order.status === "PENDING" && order.isSeller && merchantIsSelling && "Waiting for buyer to pay"}
                {order.status === "PENDING" && order.isSeller && !merchantIsSelling && "Send payment to trader"}
                {order.status === "PAID" && order.isBuyer && merchantIsSelling && "Payment sent — waiting for release"}
                {order.status === "PAID" && order.isBuyer && !merchantIsSelling && "Verify payment and release crypto"}
                {order.status === "PAID" && order.isSeller && merchantIsSelling && "Verify the payment and release"}
                {order.status === "PAID" && order.isSeller && !merchantIsSelling && "Payment marked sent"}
                {order.status === "DISPUTED" && "Dispute in progress"}
              </h2>

              {order.status === "PENDING" && order.isBuyer && merchantIsSelling && (
                <ol className="space-y-3 text-sm text-slate-400">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#087cff]/20 text-[#087cff] text-xs font-black flex items-center justify-center shrink-0">1</span>
                    <span>Send <span className="text-white font-bold">{formatFiat(Number(order.fiatAmount), order.ad.fiat)}</span> to the merchant via <span className="text-white font-bold">{order.paymentMethod === "MPESA" ? "M-Pesa" : "Bank Transfer"}</span>.</span>
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

              {order.status === "PENDING" && order.isBuyer && !merchantIsSelling && (
                <ol className="space-y-3 text-sm text-slate-400">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#087cff]/20 text-[#087cff] text-xs font-black flex items-center justify-center shrink-0">1</span>
                    <span>Your <span className="text-white font-bold">{order.crypto}</span> is locked in escrow. Wait for the merchant to send you <span className="text-white font-bold">{formatFiat(Number(order.fiatAmount), order.ad.fiat)}</span> via {order.paymentMethod === "MPESA" ? "M-Pesa" : "bank transfer"}.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#087cff]/20 text-[#087cff] text-xs font-black flex items-center justify-center shrink-0">2</span>
                    <span>Once you receive the payment, click <strong className="text-white">Release Crypto</strong> to complete the trade.</span>
                  </li>
                </ol>
              )}

              {order.status === "PENDING" && order.isSeller && merchantIsSelling && (
                <p className="text-slate-400 text-sm leading-relaxed">
                  Wait for the buyer to complete payment. You will be notified when they mark it as paid.
                  Do <strong className="text-white">not</strong> release crypto until you verify the payment in your account.
                </p>
              )}

              {order.status === "PENDING" && order.isSeller && !merchantIsSelling && (
                <ol className="space-y-3 text-sm text-slate-400">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#087cff]/20 text-[#087cff] text-xs font-black flex items-center justify-center shrink-0">1</span>
                    <span>Send <span className="text-white font-bold">{formatFiat(Number(order.fiatAmount), order.ad.fiat)}</span> to the trader via <span className="text-white font-bold">{order.paymentMethod === "MPESA" ? "M-Pesa" : "Bank Transfer"}</span>.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#087cff]/20 text-[#087cff] text-xs font-black flex items-center justify-center shrink-0">2</span>
                    <span>After sending payment, click <strong className="text-white">Payment Sent</strong>. The trader will then release {order.crypto} from escrow.</span>
                  </li>
                </ol>
              )}

              {order.status === "PAID" && order.isSeller && merchantIsSelling && (
                <ol className="space-y-3 text-sm text-slate-400">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#05b957]/20 text-[#05b957] text-xs font-black flex items-center justify-center shrink-0">1</span>
                    <span>Check your <strong className="text-white">{order.paymentMethod === "MPESA" ? "M-Pesa" : "Bank"}</strong> for a payment of <strong className="text-white">{formatFiat(Number(order.fiatAmount), order.ad.fiat)}</strong>.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#05b957]/20 text-[#05b957] text-xs font-black flex items-center justify-center shrink-0">2</span>
                    <span>Once confirmed, click <strong className="text-white">Release Crypto</strong> to complete the trade.</span>
                  </li>
                </ol>
              )}

              {order.status === "PAID" && order.isBuyer && merchantIsSelling && (
                <p className="text-slate-400 text-sm leading-relaxed">
                  Your payment has been recorded. The merchant is verifying it now.
                  If they don&apos;t release within a reasonable time, you can raise a dispute.
                </p>
              )}

              {order.status === "PAID" && order.isBuyer && !merchantIsSelling && (
                <p className="text-slate-400 text-sm leading-relaxed">
                  The merchant marked fiat as paid. Verify the payment in your account before releasing crypto.
                </p>
              )}

              {order.status === "PAID" && order.isSeller && !merchantIsSelling && (
                <p className="text-slate-400 text-sm leading-relaxed">
                  You marked fiat as paid. The seller must verify payment and release crypto from escrow.
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
                ? "bg-[#05b957]/5 border-[#05b957]/20"
                : "bg-white/5 border-white/10"
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <Icon
                  name={order.status === "RELEASED" ? "check_circle" : "cancel"}
                  className={`text-2xl ${order.status === "RELEASED" ? "text-[#05b957]" : "text-slate-500"}`}
                />
                <h2 className="text-white font-black text-lg">
                  {order.status === "RELEASED" ? "Trade Completed!" : order.status === "CANCELLED" ? "Order Cancelled" : "Order Expired"}
                </h2>
              </div>
              {order.status === "RELEASED" && (
                <p className="text-slate-400 text-sm">
                  <strong className="text-[#05b957]">{Number(order.cryptoAmount).toFixed(6)} {order.crypto}</strong> has been released successfully.
                </p>
              )}
              {order.cancelReason && (
                <p className="text-slate-500 text-sm mt-2">Reason: {order.cancelReason}</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          {!isClosed && (
            <div className="bg-[#111118] border border-white/[0.06] rounded-2xl p-5 space-y-4">

              {/* Buyer: I've Paid */}
              {order.isBuyer && order.status === "PENDING" && merchantIsSelling && (
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
                      ? <LoadingDots label="Confirming" />
                      : "✓ I've Paid"}
                  </button>
                </div>
              )}

              {order.isSeller && order.status === "PENDING" && !merchantIsSelling && (
                <button
                  onClick={() => doAction("paid", { paymentRef: paidRef || null }, "paid")}
                  disabled={!!actionLoading}
                  className="w-full py-3 rounded-xl font-black text-white bg-[#087cff] hover:bg-[#0570e8] disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {actionLoading === "paid"
                    ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Confirming…</span>
                    : "Payment Sent"}
                </button>
              )}

              {/* Seller: Release */}
              {order.isSeller && order.status === "PAID" && merchantIsSelling && (
                <button
                  onClick={() => doAction("release", {}, "release")}
                  disabled={!!actionLoading}
                  className="w-full py-3 rounded-xl font-black text-white bg-[#05b957] hover:bg-[#28af52] disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {actionLoading === "release"
                    ? <LoadingDots label="Releasing" />
                    : `Release ${Number(order.cryptoAmount).toFixed(6)} ${order.crypto}`}
                </button>
              )}

              {order.isBuyer && order.status === "PAID" && !merchantIsSelling && (
                <button
                  onClick={() => doAction("release", {}, "release")}
                  disabled={!!actionLoading}
                  className="w-full py-3 rounded-xl font-black text-white bg-[#05b957] hover:bg-[#28af52] disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {actionLoading === "release"
                    ? <LoadingDots label="Releasing" />
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
        <div className="bg-[#111118] border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: "420px" }}>
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <Icon name="chat" className="text-slate-500 text-base" />
            <span className="text-slate-300 font-bold text-sm">Order Chat</span>
            {!isClosed && (
              <span className="ml-auto w-2 h-2 rounded-full bg-[#05b957] animate-pulse" title="Live" />
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
