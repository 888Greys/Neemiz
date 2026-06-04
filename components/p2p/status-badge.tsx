// Shared P2P order status badge — single source of truth for status colours and
// labels so the order list and order detail screens never drift apart again.

export type P2POrderStatus =
  | "PENDING" | "PAID" | "RELEASED" | "DISPUTED" | "CANCELLED" | "EXPIRED";

const COLORS: Record<P2POrderStatus, string> = {
  PENDING:   "text-amber-400 bg-amber-500/10 border-amber-500/20",
  PAID:      "text-[#087cff] bg-[#087cff]/10 border-[#087cff]/20",
  RELEASED:  "text-[#05b957] bg-[#05b957]/10 border-[#05b957]/20",
  DISPUTED:  "text-red-400 bg-red-500/10 border-red-500/20",
  CANCELLED: "text-slate-400 bg-white/5 border-white/10",
  EXPIRED:   "text-slate-500 bg-white/5 border-white/10",
};

const LABELS_COMPACT: Record<P2POrderStatus, string> = {
  PENDING: "Pending", PAID: "Paid", RELEASED: "Completed",
  DISPUTED: "Disputed", CANCELLED: "Cancelled", EXPIRED: "Expired",
};

const LABELS_DETAILED: Record<P2POrderStatus, string> = {
  PENDING: "Awaiting Payment", PAID: "Payment Completed", RELEASED: "Completed",
  DISPUTED: "In Dispute", CANCELLED: "Cancelled", EXPIRED: "Expired",
};

export function P2PStatusBadge({
  status,
  size = "sm",
  detailed = false,
}: {
  status: P2POrderStatus;
  size?: "sm" | "md";
  detailed?: boolean;
}) {
  const color = COLORS[status];
  const label = (detailed ? LABELS_DETAILED : LABELS_COMPACT)[status];
  const sizing = size === "md"
    ? "px-3 py-1 text-xs font-bold"
    : "px-2.5 py-0.5 text-[10px] font-black whitespace-nowrap";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${sizing} ${color}`}>
      {status === "PENDING" && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
      {label}
    </span>
  );
}
