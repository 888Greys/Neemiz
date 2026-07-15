"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { P2PSubNav } from "@/components/p2p-subnav";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";
import { LoadingDots } from "@/components/loading-dots";
import { FIAT_CURRENCIES, formatFiat } from "@/lib/p2p/currencies";
import { paymentMethodLabel } from "@/lib/p2p/payment-methods";
import {
  BuySellTabs,
  P2PMarketTabs,
  P2P_COIN_ICONS,
  P2P_MAIN_COINS,
  PaymentMethodsSheet,
  SelectCoinSheet,
} from "@/components/p2p-market-chrome";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const;

export function P2PExpressClient({ defaultFiat = "KES" }: { defaultFiat?: string }) {
  const { isSignedIn } = useSupabaseAuth();
  const { openLogin } = useAuthModal();
  const router = useRouter();

  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [crypto, setCrypto] = useState("USDT");
  const [fiat, setFiat] = useState(
    FIAT_CURRENCIES.some((f) => f.code === defaultFiat) ? defaultFiat : "KES",
  );
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState("");
  const [paymentPicked, setPaymentPicked] = useState(false);
  const [rate, setRate] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [excludeVerify, setExcludeVerify] = useState(false);
  const [coinSheetOpen, setCoinSheetOpen] = useState(false);
  const [paySheetOpen, setPaySheetOpen] = useState(false);

  useEffect(() => {
    document.cookie = `user_fiat=${fiat}; path=/; max-age=31536000; samesite=lax`;
  }, [fiat]);

  useEffect(() => {
    if (crypto === "KES") {
      setRate(1);
      return;
    }
    let cancelled = false;
    setRate(null);
    fetch(`/api/p2p/spot?crypto=${crypto}&fiat=${fiat}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { rate?: number | null } | null) => {
        if (!cancelled && typeof d?.rate === "number" && d.rate > 0) setRate(d.rate);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [crypto, fiat]);

  const amountNum = Number(amount) || 0;
  const estCrypto = amountNum > 0 && rate ? amountNum / rate : 0;

  function pressKey(key: (typeof KEYS)[number]) {
    if (key === "back") {
      setAmount((a) => a.slice(0, -1));
      return;
    }
    if (key === ".") {
      setAmount((a) => (a.includes(".") ? a : a === "" ? "0." : `${a}.`));
      return;
    }
    setAmount((a) => {
      if (a === "0") return key;
      if (a.includes(".") && (a.split(".")[1]?.length ?? 0) >= 2) return a;
      if (a.replace(".", "").length >= 12) return a;
      return `${a}${key}`;
    });
  }

  async function buyNow() {
    if (!isSignedIn) {
      openLogin();
      return;
    }
    if (side === "SELL") {
      toast.error("Express sell is coming soon — use P2P listings for now");
      return;
    }
    if (amountNum <= 0) return toast.error("Enter an amount");
    if (!payment) return toast.error("Choose a payment method");
    setSubmitting(true);
    try {
      const res = await fetch("/api/p2p/express", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crypto, fiat, amount: amountNum, paymentMethod: payment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No match found");
      router.push(`/p2p/order/${data.orderId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't match an offer");
      setSubmitting(false);
    }
  }

  function onPrimary() {
    if (!paymentPicked || !payment) {
      setPaySheetOpen(true);
      return;
    }
    void buyNow();
  }

  const displayAmount = amount === "" ? "0" : amount;
  const primaryLabel = !paymentPicked || !payment
    ? "Select payment method"
    : side === "BUY"
      ? `Buy ${crypto}`
      : `Sell ${crypto}`;

  return (
    <>
      <SelectCoinSheet
        open={coinSheetOpen}
        value={crypto}
        onClose={() => setCoinSheetOpen(false)}
        onChange={setCrypto}
        coins={[...P2P_MAIN_COINS]}
      />
      <PaymentMethodsSheet
        open={paySheetOpen}
        fiat={fiat}
        value={payment}
        onClose={() => setPaySheetOpen(false)}
        allowAll={false}
        onConfirm={(code) => {
          if (typeof code !== "string" || !code) return;
          setPayment(code);
          setPaymentPicked(true);
        }}
      />

      <div className="hidden lg:block">
        <P2PSubNav />
      </div>

      <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-lg flex-col px-4 pb-4 pt-2 sm:max-w-md">
        <P2PMarketTabs fiat={fiat} onFiatChange={setFiat} />
        <BuySellTabs value={side} onChange={setSide} />

        {/* Coin chip */}
        <button
          type="button"
          onClick={() => setCoinSheetOpen(true)}
          className="mb-6 flex items-center gap-1.5 self-start text-[15px] font-bold text-white"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={P2P_COIN_ICONS[crypto]} alt="" className="h-5 w-5 rounded-full" />
          {crypto}
          <Icon name="expand_more" className="text-[18px] text-slate-500" />
        </button>

        {/* Large amount */}
        <div className="mb-2 flex items-baseline gap-2">
          <span
            className={`text-[48px] font-bold leading-none tracking-tight tabular-nums ${
              amount === "" ? "text-slate-600" : "text-white"
            }`}
          >
            {displayAmount}
          </span>
          <span className="text-[28px] font-bold text-slate-500">{fiat}</span>
        </div>

        {/* Rate row */}
        <div className="mb-6 flex items-center gap-2 text-[13px] text-slate-500">
          <Icon name="swap_horiz" className="text-[18px] text-slate-500" />
          <span className="tabular-nums text-slate-400">
            {estCrypto > 0 ? estCrypto.toFixed(6) : "0"} {crypto}
          </span>
          <span className="text-slate-600">·</span>
          <span>
            1 {crypto} ≈ {rate ? formatFiat(rate, fiat) : "—"}
          </span>
        </div>

        {/* Exclude verification */}
        <label className="mb-8 flex cursor-pointer items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={excludeVerify}
            onClick={() => setExcludeVerify((v) => !v)}
            className={`relative h-[22px] w-[40px] shrink-0 rounded-full transition ${
              excludeVerify ? "bg-[#087cff]" : "bg-[#3a3a3c]"
            }`}
          >
            <span
              className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition ${
                excludeVerify ? "left-[20px]" : "left-[2px]"
              }`}
            />
          </button>
          <span className="text-[13px] font-medium text-slate-400">
            Exclude ads that required verification
          </span>
        </label>

        {paymentPicked && payment && (
          <button
            type="button"
            onClick={() => setPaySheetOpen(true)}
            className="mb-3 flex w-full items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2.5 text-left"
          >
            <span className="text-[12px] text-slate-500">Payment</span>
            <span className="flex items-center gap-1 text-[13px] font-bold text-white">
              {paymentMethodLabel(payment)}
              <Icon name="expand_more" className="text-[16px] text-slate-500" />
            </span>
          </button>
        )}

        <div className="mt-auto space-y-3">
          <button
            type="button"
            onClick={onPrimary}
            disabled={submitting || (!!paymentPicked && !!payment && amountNum <= 0)}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#0d3d28] text-[15px] font-bold text-[#3dd68c] transition hover:bg-[#104a30] disabled:opacity-40"
          >
            {submitting ? <LoadingDots /> : primaryLabel}
          </button>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-y-1">
            {KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => pressKey(key)}
                className="flex h-14 items-center justify-center text-[28px] font-medium text-white transition active:bg-white/[0.06]"
              >
                {key === "back" ? (
                  <Icon name="undo" className="text-[26px] text-slate-300" />
                ) : (
                  key
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
