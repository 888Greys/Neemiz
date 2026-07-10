"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import {
  CRYPTO_WITHDRAW_ASSETS,
  type CryptoWithdrawAsset,
} from "@/lib/wallet-withdraw-options";

type BalanceRow = {
  crypto: string;
  network: string;
  available: number;
};

const COIN_ICON_URL: Record<string, string> = {
  USDT: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdt.svg",
  USDC: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdc.svg",
  BTC: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/btc.svg",
};

function fmtAvail(n: number, code: string): string {
  const decimals = code === "BTC" ? 8 : 6;
  return n.toFixed(decimals).replace(/\.?0+$/, "") || "0";
}

/**
 * Crypto withdraw asset picker — Payment Methods / Select Coin bottom sheet,
 * with available balance on each row (Nezeem / exchange style).
 */
export function CryptoWithdrawAssetSheet({
  open,
  value,
  balances,
  onClose,
  onChange,
}: {
  open: boolean;
  value: CryptoWithdrawAsset;
  balances: BalanceRow[];
  onClose: () => void;
  onChange: (asset: CryptoWithdrawAsset) => void;
}) {
  const [q, setQ] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [...CRYPTO_WITHDRAW_ASSETS];
    return CRYPTO_WITHDRAW_ASSETS.filter(
      (a) =>
        a.code.toLowerCase().includes(term)
        || a.name.toLowerCase().includes(term)
        || a.displayNet.toLowerCase().includes(term)
        || a.network.toLowerCase().includes(term),
    );
  }, [q]);

  function availFor(a: CryptoWithdrawAsset): number {
    return balances.find((b) => b.crypto === a.code && b.network === a.network)?.available ?? 0;
  }

  if (!open || !mounted) return null;

  const sheet = (
    <div
      className="fixed inset-0 z-[140] flex items-end justify-center bg-black/65"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl bg-[#1c1c1e] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <h2 className="text-[17px] font-bold text-white">Select Coin</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-white/[0.06]"
            aria-label="Close"
          >
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
              className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-slate-500"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} className="text-slate-500 hover:text-white">
                <Icon name="cancel" className="text-[16px]" />
              </button>
            )}
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
          style={{ touchAction: "pan-y" }}
        >
          {filtered.map((a) => {
            const active = a.code === value.code && a.network === value.network;
            const avail = availFor(a);
            return (
              <button
                key={`${a.code}:${a.network}`}
                type="button"
                onClick={() => {
                  onChange(a);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition ${
                  active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
                }`}
              >
                {COIN_ICON_URL[a.code] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={COIN_ICON_URL[a.code]}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full"
                  />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[11px] font-black text-slate-300">
                    {a.code.slice(0, 1)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-white">{a.code}</span>
                  <span className="block text-[12px] font-medium text-slate-500">
                    {a.displayNet}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[13px] font-bold tabular-nums text-white">
                    {fmtAvail(avail, a.code)}
                  </span>
                  <span className="block text-[10px] font-semibold text-slate-500">
                    Available
                  </span>
                </span>
                {active && <Icon name="check" className="shrink-0 text-[20px] text-white" />}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-12 text-center text-[13px] text-slate-500">
              No coins match “{q}”
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}

/** Collapsed trigger chip — same chrome as country / payment method pickers. */
export function CryptoWithdrawAssetTrigger({
  asset,
  available,
  onOpen,
}: {
  asset: CryptoWithdrawAsset;
  available: number | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-left transition hover:border-white/15 active:scale-[0.99]"
    >
      {COIN_ICON_URL[asset.code] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={COIN_ICON_URL[asset.code]}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full"
        />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-white">{asset.code}</span>
        <span className="block text-[12px] font-medium text-slate-500">{asset.displayNet}</span>
      </span>
      <span className="shrink-0 text-right">
        {available != null ? (
          <>
            <span className="block font-mono text-[13px] font-bold tabular-nums text-white">
              {fmtAvail(available, asset.code)}
            </span>
            <span className="block text-[10px] font-semibold text-slate-500">Available</span>
          </>
        ) : (
          <span className="block text-[11px] font-semibold text-slate-600">No balance</span>
        )}
      </span>
      <Icon name="expand_more" className="shrink-0 text-[20px] text-slate-500" />
    </button>
  );
}
