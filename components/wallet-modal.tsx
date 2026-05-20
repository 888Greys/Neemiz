"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { Icon } from "@/components/icon";

const QUICK_AMOUNTS = [400, 1_000, 3_000, 5_000];
const POLL_INTERVAL = 4_000;
const MAX_POLLS = 30;

const CRYPTO_ASSETS = [
  { name: "Tether USD", code: "USDT", network: "TRC-20", min: "5", color: "bg-[#5ac8b8]", icon: "T" },
  { name: "Bitcoin", code: "BTC", network: "BTC", min: "0.0001", color: "bg-[#ff9811]", icon: "B" },
  { name: "Ethereum", code: "ETH", network: "ERC-20", min: "0.003", color: "bg-[#8792dd]", icon: "E" },
  { name: "Litecoin", code: "LTC", network: "LTC", min: "0.05", color: "bg-[#b9bec8]", icon: "L" },
];
const CRYPTO_ADDRESS = "TPAAstiM7hP8UXrpA6awtZuJkKdsG54N7";
const QR_CELLS = [
  1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1,
  1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0,
  1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1,
  0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1,
  1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0,
  0, 1, 1, 1, 0, 0, 1, 0, 1, 1, 1,
  1, 0, 0, 1, 1, 1, 0, 1, 0, 0, 1,
  1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1,
  0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 0,
  1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1,
  1, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1,
];

type DepositState =
  | { step: "idle" }
  | { step: "pending"; txId: string; amount: number }
  | { step: "confirmed"; amount: number; newBalance: number; receipt: string }
  | { step: "failed"; message: string };

type CryptoAsset = (typeof CRYPTO_ASSETS)[number];
type Props = { onClose: () => void; onDepositConfirmed?: () => void };

function normalizeMsisdn(v: string) {
  const s = v.trim().replace(/\s+/g, "");
  if (s.startsWith("+254")) return s.slice(1);
  if (s.startsWith("254")) return s;
  if (s.startsWith("0") && s.length === 10) return `254${s.slice(1)}`;
  return s;
}

function MoneyTabs({ mode, setMode }: { mode: "fiat" | "crypto"; setMode: (mode: "fiat" | "crypto") => void }) {
  return (
    <div className="grid grid-cols-2 rounded-2xl bg-white/[0.045] p-1 ring-1 ring-white/[0.07]">
      <button
        type="button"
        onClick={() => setMode("fiat")}
        className={`flex h-11 items-center justify-center gap-2.5 rounded-xl text-sm font-black transition ${
          mode === "fiat" ? "bg-[#087cff] text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
        }`}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#05b957] text-[12px] font-black text-white">$</span>
        Fiat
      </button>
      <button
        type="button"
        onClick={() => setMode("crypto")}
        className={`flex h-11 items-center justify-center gap-2.5 rounded-xl text-sm font-black transition ${
          mode === "crypto" ? "bg-[#087cff] text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
        }`}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ff9811] text-[11px] font-black text-white">B</span>
        Crypto
      </button>
    </div>
  );
}

function BonusCard() {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-base font-black text-white">Deposit bonus</p>
        <div className="flex shrink-0 items-center gap-2 text-xs font-bold text-slate-500">
          Without bonus
          <span className="flex h-7 w-11 items-center rounded-full bg-white/[0.07] p-1 ring-1 ring-white/[0.06]">
            <span className="h-5 w-5 rounded-full bg-white/80 shadow-sm" />
          </span>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-emerald-400/25 bg-[linear-gradient(135deg,#0d6fce_0%,#0aa0d7_52%,#07b85d_100%)] px-4 py-4 text-white shadow-lg shadow-black/20">
        <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#05b957] ring-2 ring-[#10141d]">
          <Icon name="check" className="text-[18px] text-white" />
        </div>
        <div className="max-w-[74%]">
          <p className="text-[15px] font-black leading-tight">+130% on the first deposit</p>
          <p className="mt-1 text-xs font-bold leading-snug text-white/85">Deposit at least USD 10 and receive the bonus</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-black/18 px-3 py-1 text-[11px] font-black">
            28d : 09h : 49m
            <Icon name="info" fill className="text-[14px]" />
          </div>
        </div>
        <div className="absolute bottom-3 right-7 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/12">
          <Icon name="redeem" fill className="text-[42px] text-white/90" />
        </div>
      </div>
    </div>
  );
}

function AssetIcon({ asset }: { asset: CryptoAsset }) {
  return <span className={`flex h-8 w-8 items-center justify-center rounded-full ${asset.color} text-sm font-black text-white`}>{asset.icon}</span>;
}

function CryptoSelector({
  asset,
  search,
  setSearch,
  open,
  setOpen,
  onSelect,
}: {
  asset: CryptoAsset;
  search: string;
  setSearch: (value: string) => void;
  open: boolean;
  setOpen: (value: boolean) => void;
  onSelect: (asset: CryptoAsset) => void;
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CRYPTO_ASSETS;
    return CRYPTO_ASSETS.filter((item) => item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q));
  }, [search]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-14 w-full items-center justify-between rounded-2xl bg-white/[0.06] px-5 text-left ring-1 ring-white/[0.08] transition hover:bg-white/[0.09]"
      >
        <span className="flex items-center gap-3 text-base font-black text-white">
          <AssetIcon asset={asset} />
          {asset.code}
        </span>
        <Icon name={open ? "expand_less" : "expand_more"} className="text-[26px] text-slate-500" />
      </button>

      {open && (
        <div className="mt-2 overflow-hidden rounded-2xl bg-[#121824] shadow-2xl shadow-black/30 ring-1 ring-white/[0.09]">
          <label className="mx-4 mt-4 flex h-12 items-center gap-3 rounded-xl bg-white/[0.06] px-4 text-slate-400 ring-1 ring-white/[0.06]">
            <Icon name="search" className="text-[22px]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-500"
            />
          </label>
          <div className="max-h-72 overflow-y-auto p-2">
            {filtered.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  onSelect(item);
                  setOpen(false);
                  setSearch("");
                }}
                className="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition hover:bg-white/[0.06]"
              >
                <AssetIcon asset={item} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-white">{item.name}</span>
                  <span className="block text-xs font-bold text-slate-500">{item.code} · {item.network}</span>
                </span>
                {asset.code === item.code && <Icon name="check_circle" fill className="text-[20px] text-[#05b957]" />}
              </button>
            ))}
            {!filtered.length && <p className="px-3 py-8 text-center text-sm font-bold text-slate-500">No coins found</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function QrPattern() {
  return (
    <div className="grid h-28 w-28 shrink-0 grid-cols-11 gap-0.5 rounded-xl bg-white p-2">
      {QR_CELLS.map((filled, index) => (
        <span key={index} className={filled ? "rounded-[1px] bg-slate-950" : "rounded-[1px] bg-white"} />
      ))}
    </div>
  );
}

function CryptoDepositPanel({
  asset,
  search,
  setSearch,
  open,
  setOpen,
  onSelect,
  onCopy,
  copied,
}: {
  asset: CryptoAsset;
  search: string;
  setSearch: (value: string) => void;
  open: boolean;
  setOpen: (value: boolean) => void;
  onSelect: (asset: CryptoAsset) => void;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="space-y-5">
      <CryptoSelector asset={asset} search={search} setSearch={setSearch} open={open} setOpen={setOpen} onSelect={onSelect} />

      {!open && (
        <>
          <button type="button" className="flex h-14 w-full items-center justify-between rounded-2xl bg-white/[0.06] px-5 text-left ring-1 ring-white/[0.08]" disabled>
            <span className="text-base font-black text-white">{asset.network}</span>
            <Icon name="expand_more" className="text-[26px] text-slate-500" />
          </button>

          <div className="text-center">
            <p className="text-sm font-bold text-slate-400">
              Minimum <span className="font-black text-white">{asset.code} {asset.min}</span>
            </p>
            <p className="mt-1 text-xs font-bold text-slate-600">Amounts below this will not be credited.</p>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/[0.08] sm:flex-row sm:items-center">
            <QrPattern />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-base font-black text-white">Deposit address</p>
              <p className="mt-2 break-all text-sm font-bold leading-relaxed text-slate-400">
                <span className="text-white">{CRYPTO_ADDRESS.slice(0, 6)}</span>{CRYPTO_ADDRESS.slice(6, -5)}
                <span className="text-white">{CRYPTO_ADDRESS.slice(-5)}</span>
              </p>
              <button
                type="button"
                onClick={onCopy}
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-[#087cff] px-5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#1990ff]"
              >
                <Icon name={copied ? "check" : "content_copy"} className="text-[19px]" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

        </>
      )}
    </div>
  );
}

export function WalletModal({ onClose, onDepositConfirmed }: Props) {
  const { isSignedIn, user } = useSupabaseAuth();
  const [mode, setMode] = useState<"fiat" | "crypto">("fiat");
  const [screen, setScreen] = useState<"methods" | "mpesa">("methods");
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoAsset>(CRYPTO_ASSETS[0]);
  const [cryptoOpen, setCryptoOpen] = useState(false);
  const [cryptoSearch, setCryptoSearch] = useState("");
  const [copiedCryptoAddress, setCopiedCryptoAddress] = useState(false);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deposit, setDeposit] = useState<DepositState>({ step: "idle" });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);

  useEffect(() => {
    const userPhone = user?.phone ?? user?.user_metadata?.phone_number;
    if (userPhone && !phone) setPhone(String(userPhone).replace("+", ""));
  }, [user, phone]);

  useEffect(() => {
    if (deposit.step !== "pending") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const txId = deposit.txId;
    pollCount.current = 0;
    pollRef.current = setInterval(async () => {
      pollCount.current += 1;
      if (pollCount.current > MAX_POLLS) {
        clearInterval(pollRef.current!);
        setDeposit({ step: "failed", message: "Payment timed out. If you paid, it will be credited shortly." });
        return;
      }

      try {
        const res = await fetch("/api/wallet/deposit/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionRequestId: txId }),
        });
        const data = await res.json();
        if (data.status === "confirmed") {
          clearInterval(pollRef.current!);
          setDeposit({ step: "confirmed", amount: deposit.amount, newBalance: data.newBalance, receipt: data.receipt ?? "" });
          onDepositConfirmed?.();
        } else if (data.status === "failed") {
          clearInterval(pollRef.current!);
          setDeposit({ step: "failed", message: data.message ?? "Payment failed." });
        }
      } catch {
        // Keep polling while the provider finishes processing.
      }
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [deposit]);

  function reset() {
    setDeposit({ step: "idle" });
    setError("");
    pollCount.current = 0;
  }

  async function copyCryptoAddress() {
    try {
      await navigator.clipboard.writeText(CRYPTO_ADDRESS);
      setCopiedCryptoAddress(true);
      window.setTimeout(() => setCopiedCryptoAddress(false), 1500);
    } catch {
      setCopiedCryptoAddress(false);
    }
  }

  async function handleDeposit() {
    if (!isSignedIn) {
      setError("Log in to deposit.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const amountKes = Number(amount);
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountKes, phoneNumber: normalizeMsisdn(phone) }),
      });
      const data = await res.json().catch(() => ({}) as Record<string, string>);
      if (!res.ok) throw new Error((data as Record<string, string>).error ?? "Failed to initiate payment.");
      setDeposit({ step: "pending", txId: data.transactionRequestId, amount: amountKes });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/72 px-3 py-6 backdrop-blur-md sm:px-6 sm:py-8" onClick={onClose}>
      <div
        className="relative flex max-h-[calc(100dvh-3rem)] w-full max-w-[440px] flex-col overflow-hidden rounded-[20px] border border-white/[0.10] bg-[#10131b]/95 text-white shadow-2xl shadow-black/55 animate-in fade-in zoom-in-95 duration-200 sm:max-h-[calc(100dvh-4rem)] sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_24%_0%,rgba(8,124,255,0.24),transparent_55%),radial-gradient(circle_at_82%_0%,rgba(5,185,87,0.16),transparent_46%)]" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] text-slate-400 ring-1 ring-white/[0.08] transition hover:bg-white/[0.12] hover:text-white"
          aria-label="Close wallet"
        >
          <Icon name="close" className="text-[23px]" />
        </button>

        <div className="no-scrollbar relative overflow-y-auto px-4 pb-5 pt-5 sm:px-6 sm:pb-7">
          {screen === "methods" ? (
            <div className="space-y-3 sm:space-y-5">
              <div>
                <h2 className="pr-10 text-3xl font-black tracking-tight text-white sm:text-4xl">Deposit</h2>
                <p className="mt-1 text-xs font-bold text-slate-500 sm:text-sm">Choose how you want to fund your Nezeem wallet.</p>
              </div>

              <MoneyTabs mode={mode} setMode={setMode} />

              {mode === "fiat" ? (
                <>
                  <button type="button" className="flex h-12 w-full items-center justify-between rounded-2xl bg-white/[0.06] px-4 text-left ring-1 ring-white/[0.08]" disabled>
                    <span className="flex items-center gap-3 text-base font-black text-white">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white">KSh</span>
                      Kenyan shilling
                    </span>
                    <Icon name="expand_more" className="text-[26px] text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScreen("mpesa");
                      setMode("fiat");
                    }}
                    className="flex h-24 w-full flex-row items-center justify-between rounded-2xl bg-white/[0.06] px-5 py-4 text-left ring-1 ring-white/[0.08] transition hover:bg-white/[0.10] active:scale-[0.99] sm:h-[112px] sm:w-[235px] sm:flex-col sm:items-start"
                  >
                    <span className="text-2xl font-black tracking-tight text-[#31c45d]">M-PESA</span>
                    <span>
                      <span className="block text-base font-black text-white">M-pesa</span>
                      <span className="block text-xs font-bold text-slate-500">Instant STK push</span>
                    </span>
                  </button>
                </>
              ) : (
                <CryptoDepositPanel
                  asset={selectedCrypto}
                  search={cryptoSearch}
                  setSearch={setCryptoSearch}
                  open={cryptoOpen}
                  setOpen={setCryptoOpen}
                  onSelect={setSelectedCrypto}
                  onCopy={copyCryptoAddress}
                  copied={copiedCryptoAddress}
                />
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  reset();
                  setScreen("methods");
                }}
                className="inline-flex h-9 items-center gap-1 rounded-full bg-white/[0.05] pl-2 pr-4 text-sm font-black text-[#75b8ff] ring-1 ring-white/[0.07] transition hover:bg-white/[0.09] hover:text-white"
              >
                <Icon name="chevron_left" className="text-[22px]" />
                Back
              </button>

              {mode === "crypto" ? (
                <div className="pr-12">
                  <h2 className="text-3xl font-black tracking-tight text-white">Crypto deposit</h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">Choose an asset and send only on the selected network.</p>
                </div>
              ) : (
                <div className="pr-12">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-400/20">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    M-Pesa
                  </div>
                  <h2 className="mt-3 text-3xl font-black tracking-tight text-white">Deposit by phone</h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">Enter your Safaricom number and approve the STK prompt.</p>
                </div>
              )}

              <MoneyTabs mode={mode} setMode={setMode} />

              {mode === "crypto" ? (
                <CryptoDepositPanel
                  asset={selectedCrypto}
                  search={cryptoSearch}
                  setSearch={setCryptoSearch}
                  open={cryptoOpen}
                  setOpen={setCryptoOpen}
                  onSelect={setSelectedCrypto}
                  onCopy={copyCryptoAddress}
                  copied={copiedCryptoAddress}
                />
              ) : deposit.step === "confirmed" ? (
                <div className="rounded-2xl bg-white/[0.06] p-6 text-center ring-1 ring-[#05b957]/30">
                  <Icon name="check_circle" fill className="mx-auto text-[54px] text-[#05b957]" />
                  <p className="mt-2 text-3xl font-black text-white">Success</p>
                  <p className="mt-1 text-sm font-bold text-slate-400">Payment confirmed. KSh {deposit.amount.toLocaleString()} was added to your wallet.</p>
                  <button type="button" onClick={reset} className="mt-5 h-14 w-full rounded-xl bg-[#087cff] text-base font-black text-white">
                    Deposit more
                  </button>
                </div>
              ) : deposit.step === "pending" ? (
                <div className="flex flex-col items-center justify-center gap-5 py-10">
                  <div className="relative flex h-20 w-20 items-center justify-center">
                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-[#087cff]/15 border-t-[#087cff]" />
                    <span className="text-2xl font-black text-[#31c45d]">M</span>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black text-white">Waiting for payment</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">Approve the M-Pesa prompt on your phone</p>
                  </div>
                  <button type="button" onClick={reset} className="text-xs font-bold text-slate-600 transition hover:text-slate-400">
                    Cancel
                  </button>
                </div>
              ) : deposit.step === "failed" ? (
                <div className="rounded-2xl bg-red-500/10 p-5 text-center ring-1 ring-red-500/25">
                  <Icon name="error" fill className="mx-auto text-[42px] text-red-400" />
                  <p className="mt-2 text-xl font-black text-white">Payment failed</p>
                  <p className="mt-1 text-sm font-semibold text-red-300">{deposit.message}</p>
                  <button type="button" onClick={reset} className="mt-5 h-12 w-full rounded-xl bg-white/[0.08] text-base font-black text-white ring-1 ring-white/[0.08]">
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number"
                    className="h-14 w-full rounded-2xl bg-white/[0.055] px-5 text-base font-bold text-white outline-none ring-1 ring-white/[0.08] placeholder:text-slate-500 transition focus:bg-white/[0.075] focus:ring-2 focus:ring-[#087cff]/50"
                  />

                  <label className="relative block">
                    <span className="absolute left-5 top-2 text-xs font-bold text-slate-500">Amount</span>
                    <input
                      type="number"
                      min="150"
                      autoFocus
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="h-14 w-full rounded-2xl bg-white/[0.055] px-5 pt-4 text-base font-bold text-white outline-none ring-1 ring-white/[0.08] transition focus:bg-white/[0.075] focus:ring-2 focus:ring-[#087cff]/50 placeholder:text-slate-600"
                    />
                  </label>

                  <p className="-mt-2 text-sm font-bold text-slate-500">KES 150 - KES 150,000</p>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setAmount(String(q))}
                        className={`h-10 rounded-xl px-3 text-sm font-black transition ${
                          amount === String(q) ? "bg-[#087cff] text-white shadow-lg shadow-blue-500/18" : "bg-white/[0.065] text-slate-300 hover:bg-white/[0.10]"
                        }`}
                      >
                        KES {q.toLocaleString()}
                      </button>
                    ))}
                  </div>

                  {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 ring-1 ring-red-500/20">{error}</p>}

                  <button
                    type="button"
                    onClick={handleDeposit}
                    disabled={loading || !amount || !phone}
                    className="h-14 w-full rounded-2xl bg-[#05b957] text-base font-black text-white shadow-lg shadow-emerald-500/18 transition hover:bg-[#07cc63] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-slate-500 disabled:shadow-none"
                  >
                    {loading ? "Sending prompt..." : "Deposit"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
