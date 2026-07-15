"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";
import { FIAT_CURRENCIES } from "@/lib/p2p/currencies";
import {
  GLOBAL_PAYMENT_METHODS,
  paymentMethodLabel,
  paymentMethodsForFiat,
} from "@/lib/p2p/payment-methods";
import { ACTIVE_LOCAL_COINS, isActiveLocalCoin } from "@/lib/p2p/local-coins";

export const P2P_COIN_ICONS: Record<string, string> = {
  USDT: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdt.svg",
  USDC: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdc.svg",
  BTC:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/btc.svg",
  ETH:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/eth.svg",
  BNB:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/bnb.svg",
  // Local coins (KES, UG, TZ, …) use their country flag as the coin icon.
  ...Object.fromEntries(ACTIVE_LOCAL_COINS.map((c) => [c.currency, `https://flagcdn.com/w80/${c.flagCode}.png`])),
};

export const P2P_MAIN_COINS = ["USDT", "USDC", "BTC", "ETH", "BNB", ...ACTIVE_LOCAL_COINS.map((c) => c.currency)] as const;

/**
 * Display label for a coin filter value. "__ALL__" is a filter-only pseudo-coin
 * (see COIN_FILTER_ALL in p2p-browse-client) with no icon, so it reads as
 * "All coins" rather than a bare code. The sentinel is deliberately not a
 * 3-letter code: "ALL" is a real coin here (Albanian Lek).
 */
export function p2pCoinLabel(code: string): string {
  return code === "__ALL__" ? "All coins" : code;
}

const flagUrl = (code: string) =>
  `https://flagcdn.com/w40/${code.slice(0, 2).toLowerCase()}.png`;

/** Express | P2P tabs + fiat pill — Bybit-style market header. */
export function P2PMarketTabs({
  fiat,
  onFiatChange,
  fiatPicker,
}: {
  fiat: string;
  onFiatChange?: (code: string) => void;
  fiatPicker?: ReactNode;
}) {
  const pathname = usePathname();
  const onExpress = pathname.startsWith("/p2p/express");

  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-end gap-5">
        <Link
          href="/p2p/express"
          prefetch={false}
          className={`relative pb-2 text-[17px] font-bold transition ${
            onExpress ? "text-white" : "text-slate-500"
          }`}
        >
          Express
          {onExpress && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" />}
        </Link>
        <Link
          href="/p2p"
          prefetch={false}
          className={`relative pb-2 text-[17px] font-bold transition ${
            !onExpress ? "text-white" : "text-slate-500"
          }`}
        >
          P2P
          {!onExpress && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" />}
        </Link>
      </div>
      {fiatPicker ?? (
        onFiatChange ? (
          <FiatPill value={fiat} onChange={onFiatChange} />
        ) : (
          <span className="rounded-full bg-white/[0.08] px-3 py-1.5 text-[13px] font-bold text-white">
            {fiat}
          </span>
        )
      )}
    </div>
  );
}

export function FiatPill({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = FIAT_CURRENCIES.find((f) => f.code === value) ?? FIAT_CURRENCIES[0];
  const term = q.trim().toLowerCase();
  const filtered = term
    ? FIAT_CURRENCIES.filter((f) => f.code.toLowerCase().includes(term) || f.name.toLowerCase().includes(term))
    : FIAT_CURRENCIES;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-full bg-white/[0.08] py-1.5 pl-2.5 pr-2 text-[13px] font-bold text-white transition hover:bg-white/[0.12]"
      >
        {current.code}
        <Icon name="expand_more" className="text-[16px] text-slate-400" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            className="flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-[#1c1c1e] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-[16px] font-bold text-white">Select currency</h3>
              <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-white/[0.06]" aria-label="Close">
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2 rounded-xl bg-[#2c2c2e] px-3">
                <Icon name="search" className="text-[18px] text-slate-500" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search"
                  className="h-11 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-slate-500"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              {filtered.map((f) => (
                <button
                  key={f.code}
                  type="button"
                  onClick={() => { onChange(f.code); setOpen(false); setQ(""); }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${f.code === value ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={flagUrl(f.code)} alt="" className="h-5 w-7 rounded-sm object-cover" />
                  <span className="text-[14px] font-bold text-white">{f.code}</span>
                  <span className="truncate text-[12px] text-slate-500">{f.name}</span>
                  {f.code === value && <Icon name="check" className="ml-auto text-[18px] text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function BuySellPill({
  value,
  onChange,
}: {
  value: "BUY" | "SELL";
  onChange: (v: "BUY" | "SELL") => void;
}) {
  return (
    <div className="mb-3 inline-flex rounded-full bg-[#2c2c2e] p-0.5">
      {(["BUY", "SELL"] as const).map((side) => (
        <button
          key={side}
          type="button"
          onClick={() => onChange(side)}
          className={`min-w-[72px] rounded-full px-5 py-1.5 text-[14px] font-bold transition ${
            value === side ? "bg-[#3a3a3c] text-white" : "text-slate-500"
          }`}
        >
          {side === "BUY" ? "Buy" : "Sell"}
        </button>
      ))}
    </div>
  );
}

/** Express-style Buy / Sell text tabs. */
export function BuySellTabs({
  value,
  onChange,
}: {
  value: "BUY" | "SELL";
  onChange: (v: "BUY" | "SELL") => void;
}) {
  return (
    <div className="mb-4 flex items-center gap-6">
      {(["BUY", "SELL"] as const).map((side) => (
        <button
          key={side}
          type="button"
          onClick={() => onChange(side)}
          className={`text-[16px] font-bold transition ${
            value === side ? "text-white" : "text-slate-500"
          }`}
        >
          {side === "BUY" ? "Buy" : "Sell"}
        </button>
      ))}
    </div>
  );
}

/** Select Coin — bottom sheet (same chrome as Payment Methods; does not cover the full top). */
export function SelectCoinSheet({
  open,
  value,
  onClose,
  onChange,
  coins = [...P2P_MAIN_COINS],
}: {
  open: boolean;
  value: string;
  onClose: () => void;
  onChange: (code: string) => void;
  coins?: string[];
}) {
  const [q, setQ] = useState("");
  useEffect(() => {
    if (open) setQ("");
  }, [open]);
  if (!open) return null;

  const term = q.trim().toLowerCase();
  const filtered = term ? coins.filter((c) => c.toLowerCase().includes(term)) : coins;

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/65 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl bg-[#1c1c1e] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:max-h-[min(32rem,80dvh)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <h2 className="text-[17px] font-bold text-white">Select Coin</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-white/[0.06]" aria-label="Close">
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>
        <div className="shrink-0 px-4 pb-2">
          <div className="flex items-center gap-2 rounded-xl bg-[#2c2c2e] px-3">
            <Icon name="search" className="text-[18px] text-slate-500" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Coin"
              className="h-11 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-slate-500"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.map((c, index) => {
            const prev = filtered[index - 1];
            const isLocal = c !== "__ALL__" && isActiveLocalCoin(c);
            const isChain = c !== "__ALL__" && !isLocal;
            const showChainHead =
              !term && isChain && filtered.slice(0, index).every((x) => x === "__ALL__");
            const showInAppHead =
              !term && isLocal && (index === 0 || (prev != null && (prev === "__ALL__" || !isActiveLocalCoin(prev))));

            return (
              <div key={c}>
                {showChainHead && (
                  <p className="px-4 pb-1 pt-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    On-chain crypto
                  </p>
                )}
                {showInAppHead && (
                  <p className="px-4 pb-1 pt-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    In-app coins
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => { onChange(c); onClose(); }}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${
                    c === value ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {P2P_COIN_ICONS[c]
                    ? <img src={P2P_COIN_ICONS[c]} alt="" className="h-8 w-8 rounded-full" />
                    : <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.08] text-[11px] font-bold text-slate-300">ALL</span>}
                  <span className="flex-1 text-[15px] font-bold text-white">{p2pCoinLabel(c)}</span>
                  {c === value && <Icon name="check" className="text-[20px] text-white" />}
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-12 text-center text-[13px] text-slate-500">No coins match “{q}”</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Payment methods bottom sheet — All / Popular / Other + Reset / Confirm. */
export function PaymentMethodsSheet({
  open,
  fiat,
  value,
  onClose,
  onConfirm,
  allowAll = true,
}: {
  open: boolean;
  fiat: string;
  value: string;
  onClose: () => void;
  onConfirm: (code: string) => void;
  allowAll?: boolean;
}) {
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) {
      setDraft(value);
      setQ("");
    }
  }, [open, value]);

  const popular = useMemo(() => paymentMethodsForFiat(fiat), [fiat]);
  const popularCodes = useMemo(() => new Set(popular.map((m) => m.value)), [popular]);
  const other = useMemo(
    () => GLOBAL_PAYMENT_METHODS.filter((m) => !popularCodes.has(m.value)),
    [popularCodes],
  );

  const term = q.trim().toLowerCase();
  const match = (label: string, code: string) =>
    !term || label.toLowerCase().includes(term) || code.toLowerCase().includes(term);
  const popularFiltered = popular.filter((m) => match(m.label, m.value));
  const otherFiltered = other.filter((m) => match(m.label, m.value));
  const showAll = allowAll && (!term || "all".includes(term));

  if (!open) return null;

  const Row = ({ code, label }: { code: string; label: string }) => (
    <button
      type="button"
      onClick={() => setDraft(code)}
      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition ${
        draft === code ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
      }`}
    >
      <span className="flex-1 text-[14px] font-semibold text-white">{label}</span>
      {draft === code && <Icon name="check" className="shrink-0 text-[20px] text-white" />}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/65 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl bg-[#1c1c1e] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:max-h-[min(32rem,80dvh)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-[17px] font-bold text-white">Payment Methods</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-white/[0.06]" aria-label="Close">
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 rounded-xl bg-[#2c2c2e] px-3">
            <Icon name="search" className="text-[18px] text-slate-500" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Payment Methods"
              className="h-11 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-slate-500"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {showAll && <Row code="" label="All" />}
          {popularFiltered.length > 0 && (
            <>
              <p className="px-4 pb-1 pt-3 text-[12px] font-semibold text-slate-500">Popular 🔥</p>
              {popularFiltered.map((m) => (
                <Row key={m.value} code={m.value} label={m.label} />
              ))}
            </>
          )}
          {otherFiltered.length > 0 && (
            <>
              <p className="px-4 pb-1 pt-3 text-[12px] font-semibold text-slate-500">Other</p>
              {otherFiltered.map((m) => (
                <Row key={m.value} code={m.value} label={m.label} />
              ))}
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-white/[0.06] px-4 py-3">
          <button
            type="button"
            onClick={() => setDraft(allowAll ? "" : (popular[0]?.value ?? ""))}
            className="h-12 rounded-full border border-white/25 text-[14px] font-bold text-white transition hover:bg-white/[0.04]"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(draft); onClose(); }}
            className="h-12 rounded-full bg-[#087cff] text-[14px] font-bold text-white transition hover:bg-[#0570e8]"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/** Compact filter chip row: Coin · Amount · Payment · (optional filter). */
export function P2PFilterRow({
  crypto,
  amountLabel,
  paymentLabel,
  onCoin,
  onAmount,
  onPayment,
  onFilter,
}: {
  crypto: string;
  amountLabel: string;
  paymentLabel: string;
  onCoin: () => void;
  onAmount: () => void;
  onPayment: () => void;
  onFilter?: () => void;
}) {
  const Chip = ({
    children,
    onClick,
    className = "",
  }: {
    children: ReactNode;
    onClick: () => void;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 shrink-0 items-center gap-1 rounded-lg bg-transparent text-[13px] font-semibold text-white transition hover:text-slate-200 ${className}`}
    >
      {children}
      <Icon name="expand_more" className="text-[16px] text-slate-500" />
    </button>
  );

  return (
    <div className="mb-3 flex items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Chip onClick={onCoin}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {P2P_COIN_ICONS[crypto] && (
          <img src={P2P_COIN_ICONS[crypto]} alt="" className="h-4 w-4 rounded-full" />
        )}
        {p2pCoinLabel(crypto)}
      </Chip>
      <Chip onClick={onAmount}>{amountLabel}</Chip>
      <Chip onClick={onPayment} className="min-w-0 max-w-[42vw]">
        <span className="truncate">{paymentLabel}</span>
      </Chip>
      {onFilter && (
        <button
          type="button"
          onClick={onFilter}
          className="ml-auto grid h-8 w-8 shrink-0 place-items-center text-slate-400 transition hover:text-white"
          aria-label="Filters"
        >
          <Icon name="tune" className="text-[20px]" />
        </button>
      )}
    </div>
  );
}

export function paymentChipLabel(code: string) {
  return code ? paymentMethodLabel(code) : "All Payment Methods";
}

export function AmountFilterSheet({
  open,
  value,
  fiat,
  onClose,
  onConfirm,
}: {
  open: boolean;
  value: string;
  fiat: string;
  onClose: () => void;
  onConfirm: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/65 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl bg-[#1c1c1e] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-white">Amount</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-white/[0.06]" aria-label="Close">
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#2c2c2e] px-3">
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="0"
            className="h-12 flex-1 bg-transparent text-[16px] font-bold text-white outline-none placeholder:text-slate-500"
          />
          <span className="text-[14px] font-bold text-slate-400">{fiat}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => { setDraft(""); onConfirm(""); onClose(); }}
            className="h-12 rounded-full border border-white/25 text-[14px] font-bold text-white"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(draft.trim()); onClose(); }}
            className="h-12 rounded-full bg-[#087cff] text-[14px] font-bold text-white"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
