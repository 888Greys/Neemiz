/**
 * Distinct, consistent colors for transaction/bet/trade statuses across the
 * admin console so the owner can read outcomes at a glance.
 */

type Tone = { bg: string; text: string; ring: string };

const TONES: Record<string, Tone> = {
  green:  { bg: "bg-emerald-500/12", text: "text-emerald-400", ring: "ring-emerald-500/25" },
  red:    { bg: "bg-red-500/12",     text: "text-red-400",     ring: "ring-red-500/25" },
  amber:  { bg: "bg-amber-500/12",   text: "text-amber-400",   ring: "ring-amber-500/25" },
  violet: { bg: "bg-violet-500/12",  text: "text-violet-400",  ring: "ring-violet-500/25" },
  sky:    { bg: "bg-sky-500/12",     text: "text-sky-400",     ring: "ring-sky-500/25" },
  orange: { bg: "bg-orange-500/12",  text: "text-orange-400",  ring: "ring-orange-500/25" },
  fuchsia:{ bg: "bg-fuchsia-500/12", text: "text-fuchsia-400", ring: "ring-fuchsia-500/25" },
  slate:  { bg: "bg-white/[0.06]",   text: "text-slate-400",   ring: "ring-white/[0.1]" },
};

// Map any status/type token → a color tone.
function toneFor(raw: string): keyof typeof TONES {
  const s = raw.toUpperCase();
  // Wins / money in / good outcomes
  if (["WON", "WIN", "BET_WIN", "CASHED_OUT", "CASHEDOUT", "RELEASED", "COMPLETED", "PAID", "SUCCESS", "APPROVED", "CLOSED", "RESOLVED"].some((k) => s.includes(k))) return "green";
  // Losses / failures
  if (["LOST", "LOSE", "BUSTED", "STOPPED", "KNOCKED_OUT", "FAILED", "REJECTED", "DISPUTED", "DECLIN"].some((k) => s.includes(k))) return "red";
  // In-flight
  if (["PENDING", "OPEN", "ACTIVE", "PROCESSING", "BETTING", "FLYING", "WAITING"].some((k) => s.includes(k))) return "amber";
  // Neutral / reversed
  if (["VOID", "CANCEL", "EXPIRED", "REFUND"].some((k) => s.includes(k))) return "slate";
  // Money movement / categories
  if (s.includes("STAKE")) return "violet";
  if (s.includes("DEPOSIT")) return "sky";
  if (s.includes("WITHDRAW")) return "orange";
  if (s.includes("BONUS")) return "fuchsia";
  return "slate";
}

export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const tone = TONES[toneFor(status)];
  const label = status.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ring-1 ring-inset ${tone.bg} ${tone.text} ${tone.ring} ${className}`}>
      {label}
    </span>
  );
}
