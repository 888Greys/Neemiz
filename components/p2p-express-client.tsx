"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { P2PSubNav } from "@/components/p2p-subnav";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";
import { LoadingDots } from "@/components/loading-dots";
import { FIAT_CURRENCIES, formatFiat } from "@/lib/p2p/currencies";
import { paymentMethodsForFiat } from "@/lib/p2p/payment-methods";

const flagUrl = (code: string) => `https://flagcdn.com/w40/${code.slice(0, 2).toLowerCase()}.png`;

const COINS = [
  { code: "USDT", name: "Tether",   icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdt.svg" },
  { code: "USDC", name: "USD Coin", icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdc.svg" },
  { code: "BTC",  name: "Bitcoin",  icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/btc.svg" },
  { code: "ETH",  name: "Ethereum", icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/eth.svg" },
  { code: "BNB",  name: "BNB",      icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/bnb.svg" },
];

// ─── Tiny click-outside dropdown ───────────────────────────────────────────────
type DropOption = { value: string; label: string; icon?: string };
function Dropdown({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: DropOption[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 text-[13px] font-bold text-white transition-colors hover:border-white/20"
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          {current?.icon && <img src={current.icon} alt="" width={16} height={16} className="h-4 w-4 shrink-0 rounded-full" />}
          <span className="truncate">{current?.label ?? label}</span>
        </span>
        <Icon name="expand_more" className={`shrink-0 text-[15px] text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-[#121824] py-1 shadow-2xl shadow-black/40 [scrollbar-width:thin]">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-bold text-white transition hover:bg-white/[0.06]"
            >
              {o.icon && <img src={o.icon} alt="" width={16} height={16} className="h-4 w-4 shrink-0 rounded-full" />}
              <span className="flex-1 truncate">{o.label}</span>
              {o.value === value && <Icon name="check" className="shrink-0 text-[15px] text-[#087cff]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function P2PExpressClient({ defaultFiat = "KES" }: { defaultFiat?: string }) {
  const { isSignedIn } = useSupabaseAuth();
  const { openLogin }  = useAuthModal();
  const router         = useRouter();
  const { balance: coinBalance, currency: coinCurrency } = useWalletBalance();

  const [crypto, setCrypto]   = useState("USDT");
  const [fiat, setFiat]       = useState(FIAT_CURRENCIES.some((f) => f.code === defaultFiat) ? defaultFiat : "KES");
  const [amount, setAmount]   = useState("");
  const [payments, setPayments] = useState(() => paymentMethodsForFiat(defaultFiat));
  const [payment, setPayment] = useState(() => paymentMethodsForFiat(defaultFiat)[0]?.value ?? "");
  const [rate, setRate]       = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Payment rails follow the selected currency.
  useEffect(() => {
    const opts = paymentMethodsForFiat(fiat);
    setPayments(opts);
    setPayment((p) => (opts.some((o) => o.value === p) ? p : opts[0]?.value ?? ""));
  }, [fiat]);

  // Live spot rate for the estimate.
  useEffect(() => {
    let cancelled = false;
    setRate(null);
    fetch(`/api/p2p/spot?crypto=${crypto}&fiat=${fiat}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { rate?: number | null } | null) => { if (!cancelled && typeof d?.rate === "number" && d.rate > 0) setRate(d.rate); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [crypto, fiat]);

  const amountNum = Number(amount) || 0;
  const estCrypto = amountNum > 0 && rate ? amountNum / rate : null;

  async function buyNow() {
    if (!isSignedIn) { openLogin(); return; }
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

  const QUICK = [500, 1000, 2500, 5000, 10000];

  return (
    <>
      <P2PSubNav />

      <div className="mx-auto w-full max-w-sm px-3 py-2.5 sm:px-4">
        <div className="rounded-xl border border-[#1e1e30] bg-[#111118] p-3.5">
          {/* Header */}
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#087cff]/12 ring-1 ring-[#087cff]/25">
              <Icon name="bolt" fill className="text-[16px] text-[#087cff]" />
            </div>
            <div>
              <h1 className="text-[15px] font-black leading-tight text-white">Express Buy</h1>
              <p className="text-[10px] font-semibold text-slate-500">Best price, auto-matched · escrow-protected</p>
            </div>
          </div>

          {/* Coin + Currency dropdowns */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">Coin</p>
              <Dropdown
                label="Coin"
                value={crypto}
                onChange={setCrypto}
                options={COINS.map((c) => ({ value: c.code, label: c.code, icon: c.icon }))}
              />
            </div>
            <div>
              <p className="mb-1 text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">Currency</p>
              <Dropdown
                label="Currency"
                value={fiat}
                onChange={setFiat}
                options={FIAT_CURRENCIES.map((f) => ({ value: f.code, label: f.code, icon: flagUrl(f.code) }))}
              />
            </div>
          </div>

          {/* Amount — paid from the local "coin" balance */}
          <div className="mb-1 mt-3 flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">Pay with {fiat} Coin</p>
            {isSignedIn && coinCurrency === fiat && (
              <button
                type="button"
                onClick={() => setAmount(String(Math.floor(coinBalance)))}
                className="text-[10px] font-black uppercase tracking-wider text-[#087cff] hover:text-[#2a90ff]"
              >
                Bal {formatFiat(coinBalance, fiat, { symbol: false })} · Max
              </button>
            )}
          </div>
          <div className="flex h-11 items-center rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 focus-within:border-[#087cff]/50">
            <img src={flagUrl(fiat)} alt="" className="mr-2 h-3.5 w-5 shrink-0 rounded-[2px] object-cover" />
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-transparent text-base font-black text-white outline-none placeholder:text-slate-700"
            />
            <span className="ml-2 text-[13px] font-black text-slate-500">{fiat}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-black text-slate-400 ring-1 ring-white/[0.06] transition hover:text-white"
              >
                {q.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Payment */}
          <p className="mb-1 mt-3 text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">Payment</p>
          <Dropdown label="Payment" value={payment} onChange={setPayment} options={payments} />

          {/* Estimate */}
          <div className="mt-3 rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">You receive (approx.)</span>
              <span className="font-black text-white">{estCrypto != null ? `≈ ${estCrypto.toFixed(6)} ${crypto}` : "—"}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className="text-slate-600">Market rate</span>
              <span className="text-slate-500">{rate ? `1 ${crypto} ≈ ${formatFiat(rate, fiat)}` : "fetching…"}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={buyNow}
            disabled={submitting || amountNum <= 0 || !payment}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#05b957] text-[13px] font-black text-white shadow-lg shadow-[#05b957]/20 transition hover:bg-[#04a64e] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? <LoadingDots /> : <><Icon name="bolt" fill className="text-[16px]" /> Buy {crypto} now</>}
          </button>

          <p className="mt-2.5 text-center text-[10px] text-slate-600">
            Prefer to choose a merchant yourself?{" "}
            <button onClick={() => router.push("/p2p")} className="font-bold text-[#087cff] hover:underline">Browse offers</button>
          </p>
        </div>
      </div>
    </>
  );
}
