"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";

export type PromoSuccessPayload = {
  amount: number;
  code: string;
};

const EVENT = "nezeem-promo-success";

/** Fire from anywhere after a successful redeem — AppShell shows the overlay. */
export function showPromoSuccess(payload: PromoSuccessPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: payload }));
}

export function PromoSuccessCard({
  amount,
  code,
  onDone,
  cta = "Got it",
}: PromoSuccessPayload & { onDone?: () => void; cta?: string }) {
  const amountLabel = Number(amount).toLocaleString(MONEY_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return (
    <div className="animate-in fade-in zoom-in-95 flex flex-col items-center px-2 py-6 text-center duration-300">
      <div className="relative mb-5 grid h-16 w-16 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20" />
        <span className="relative grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
          <Icon name="check_circle" fill className="text-[36px] text-emerald-400" />
        </span>
      </div>

      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Promo unlocked
      </p>
      <p className="mt-2 text-[1.75rem] font-black leading-none tracking-tight text-white sm:text-[2rem]">
        +{CURRENCY_SYMBOL} {amountLabel}
      </p>
      <p className="mt-3 max-w-[16rem] text-[13px] font-medium leading-relaxed text-slate-400">
        Added to your wallet. Start playing — your balance is ready.
      </p>

      <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-300 ring-1 ring-white/[0.08]">
        <Icon name="confirmation_number" fill className="text-[14px] text-[#75b8ff]" />
        {code}
      </span>

      {onDone && (
        <button
          type="button"
          onClick={onDone}
          className="mt-8 h-12 w-full max-w-xs rounded-xl bg-[#087cff] text-sm font-black text-white transition hover:bg-[#1990ff] active:scale-[0.98]"
        >
          {cta}
        </button>
      )}
    </div>
  );
}

export type PromoNoticeKind = "already_used" | "invalid" | "expired" | "exhausted" | "error";

const NOTICE: Record<PromoNoticeKind, { icon: string; tone: string; ring: string; title: string; body: string }> = {
  already_used: {
    icon: "check_circle",
    tone: "text-[#75b8ff] bg-[#087cff]/15",
    ring: "ring-[#087cff]/25",
    title: "Already claimed",
    body: "You’ve already used this promo on your account. Each code works once.",
  },
  invalid: {
    icon: "info",
    tone: "text-slate-300 bg-white/[0.06]",
    ring: "ring-white/[0.08]",
    title: "Code not found",
    body: "That promo doesn’t look right. Double-check the spelling and try again.",
  },
  expired: {
    icon: "schedule",
    tone: "text-amber-300 bg-amber-500/15",
    ring: "ring-amber-400/25",
    title: "Promo ended",
    body: "This code has expired and can’t be claimed anymore.",
  },
  exhausted: {
    icon: "block",
    tone: "text-amber-300 bg-amber-500/15",
    ring: "ring-amber-400/25",
    title: "Fully claimed",
    body: "This promo has reached its limit. Keep an eye out for the next one.",
  },
  error: {
    icon: "info",
    tone: "text-slate-300 bg-white/[0.06]",
    ring: "ring-white/[0.08]",
    title: "Couldn’t apply code",
    body: "Something went wrong. Please try again in a moment.",
  },
};

export function promoNoticeFromStatus(status: number, message?: string): PromoNoticeKind {
  if (status === 409) return "already_used";
  if (status === 410) return "exhausted";
  if (status === 404) return "invalid";
  if (message?.toLowerCase().includes("expir")) return "expired";
  return "error";
}

export function PromoNoticeCard({
  kind,
  code,
  onDone,
  cta = "Try another code",
}: {
  kind: PromoNoticeKind;
  code?: string;
  onDone?: () => void;
  cta?: string;
}) {
  const n = NOTICE[kind];

  return (
    <div className="animate-in fade-in zoom-in-95 flex flex-col items-center px-2 py-6 text-center duration-300">
      <span className={`mb-5 grid h-16 w-16 place-items-center rounded-full ring-1 ${n.tone} ${n.ring}`}>
        <Icon name={n.icon} fill className="text-[32px]" />
      </span>

      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Promo code
      </p>
      <p className="mt-2 text-[1.35rem] font-black tracking-tight text-white">
        {n.title}
      </p>
      <p className="mt-3 max-w-[17rem] text-[13px] font-medium leading-relaxed text-slate-400">
        {n.body}
      </p>

      {code && (
        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-300 ring-1 ring-white/[0.08]">
          <Icon name="confirmation_number" fill className="text-[14px] text-slate-500" />
          {code}
        </span>
      )}

      {onDone && (
        <button
          type="button"
          onClick={onDone}
          className="mt-8 h-12 w-full max-w-xs rounded-xl bg-white/[0.06] text-sm font-black text-white ring-1 ring-white/[0.08] transition hover:bg-white/[0.1] active:scale-[0.98]"
        >
          {cta}
        </button>
      )}
    </div>
  );
}

/** Global overlay host — mount once in AppShell. */
export function PromoSuccessHost() {
  const [payload, setPayload] = useState<PromoSuccessPayload | null>(null);

  useEffect(() => {
    function onEvent(e: Event) {
      const detail = (e as CustomEvent<PromoSuccessPayload>).detail;
      if (!detail?.amount || !detail?.code) return;
      setPayload(detail);
    }
    window.addEventListener(EVENT, onEvent);
    return () => window.removeEventListener(EVENT, onEvent);
  }, []);

  if (!payload) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => setPayload(null)}
    >
      <div
        className="relative w-full max-w-sm rounded-t-[1.5rem] bg-[#151518] px-5 pb-8 pt-4 shadow-2xl ring-1 ring-white/[0.08] sm:rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        <button
          type="button"
          onClick={() => setPayload(null)}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
        >
          <Icon name="close" className="text-[18px]" />
        </button>
        <PromoSuccessCard
          amount={payload.amount}
          code={payload.code}
          cta="Start playing"
          onDone={() => setPayload(null)}
        />
      </div>
    </div>
  );
}
