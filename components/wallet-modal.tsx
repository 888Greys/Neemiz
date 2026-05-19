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

type DepositState =
  | { step: "idle" }
  | { step: "pending"; txId: string; amount: number }
  | { step: "confirmed"; amount: number; newBalance: number; receipt: string }
  | { step: "failed"; message: string };

type CryptoAsset = (typeof CRYPTO_ASSETS)[number];
type Props = { onClose: () => void };

function normalizeMsisdn(v: string) {
  const s = v.trim().replace(/\s+/g, "");
  if (s.startsWith("+254")) return s.slice(1);
  if (s.startsWith("254")) return s;
  if (s.startsWith("0") && s.length === 10) return `254${s.slice(1)}`;
  return s;
}

function MoneyTabs({ mode, setMode }: { mode: "fiat" | "crypto"; setMode: (mode: "fiat" | "crypto") => void }) {
  return (
    <div className="grid grid-cols-2 rounded-2xl bg-white/[0.06] p-1 ring-1 ring-white/[0.08]">
      <button
        type="button"
        onClick={() => setMode("fiat")}
        className={`flex h-12 items-center justify-center gap-3 rounded-xl text-sm font-black transition ${
          mode === "fiat" ? "bg-[#087cff] text-white shadow-lg shadow-blue-500/25" : "text-slate-400 hover:text-white"
        }`}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#05b957] text-[13px] font-black text-white">$</span>
        Fiat
      </button>
      <button
        type="button"
        onClick={() => setMode("crypto")}
        className={`flex h-12 items-center justify-center gap-3 rounded-xl text-sm font-black transition ${
          mode === "crypto" ? "bg-[#087cff] text-white shadow-lg shadow-blue-500/25" : "text-slate-400 hover:text-white"
        }`}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ff9811] text-[12px] font-black text-white">B</span>
        Crypto
      </button>
    </div>
  );
}

function BonusCard() {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-lg font-black text-white">Deposit bonus</p>
        <div className="flex shrink-0 items-center gap-2 text-xs font-bold text-slate-500">
          Without bonus
          <span className="flex h-8 w-12 items-center rounded-full bg-white/[0.08] p-1 ring-1 ring-white/[0.06]">
            <span className="h-6 w-6 rounded-full bg-white/80 shadow-sm" />
          </span>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-[#05b957]/70 bg-gradient-to-br from-[#11365b] via-[#087cff] to-[#05b957] px-4 py-4 text-white shadow-lg shadow-blue-950/25">
        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#05b957] ring-2 ring-[#10141d]">
          <Icon name="check" className="text-[17px] text-white" />
        </div>
        <div className="max-w-[70%]">
          <p className="text-base font-black">+130% on the first deposit</p>
          <p className="mt-1 text-sm font-bold leading-snug text-white/85">Deposit at least USD 10 and receive the bonus</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-1 text-xs font-black">
            28d : 09h : 49m
            <Icon name="info" fill className="text-[15px]" />
          </div>
        </div>
        <div className="absolute bottom-2 right-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-white/10">
          <Icon name="redeem" fill className="text-[58px] text-white/90" />
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

export function WalletModal({ onClose }: Props) {
  const { isSignedIn, user } = useSupabaseAuth();
  const [mode, setMode] = useState<"fiat" | "crypto">("fiat");
  const [screen, setScreen] = useState<"methods" | "mpesa">("methods");
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoAsset>(CRYPTO_ASSETS[0]);
  const [cryptoOpen, setCryptoOpen] = useState(false);
  const [cryptoSearch, setCryptoSearch] = useState("");
  const [amount, setAmount] = useState("500");
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
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/78 px-3 py-4 backdrop-blur-md sm:px-6 sm:py-8" onClick={onClose}>
      <div
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[520px] flex-col overflow-hidden rounded-[28px] border border-white/[0.10] bg-[#0d111a] text-white shadow-2xl shadow-black/50 animate-in fade-in zoom-in-95 duration-200 sm:max-h-[calc(100dvh-4rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_30%_0%,rgba(8,124,255,0.28),transparent_55%),radial-gradient(circle_at_80%_0%,rgba(5,185,87,0.18),transparent_45%)]" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-slate-400 ring-1 ring-white/[0.08] transition hover:bg-white/[0.10] hover:text-white"
          aria-label="Close wallet"
        >
          <Icon name="close" className="text-[23px]" />
        </button>

        <div className="no-scrollbar relative overflow-y-auto px-6 pb-8 pt-8">
          {screen === "methods" ? (
            <div className="space-y-5">
              <div>
                <h2 className="pr-10 text-4xl font-black tracking-tight text-white">Deposit</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">Choose how you want to fund your Nezeem wallet.</p>
              </div>

              <MoneyTabs mode={mode} setMode={setMode} />

              {mode === "fiat" ? (
                <>
                  <button type="button" className="flex h-14 w-full items-center justify-between rounded-2xl bg-white/[0.06] px-5 text-left ring-1 ring-white/[0.08]" disabled>
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
                    className="flex h-[112px] w-[235px] flex-col items-start justify-between rounded-2xl bg-white/[0.06] px-5 py-5 text-left ring-1 ring-white/[0.08] transition hover:bg-white/[0.10] active:scale-[0.99]"
                  >
                    <span className="text-2xl font-black tracking-tight text-[#31c45d]">M-PESA</span>
                    <span>
                      <span className="block text-base font-black text-white">M-pesa</span>
                      <span className="block text-xs font-bold text-slate-500">Instant STK push</span>
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <CryptoSelector
                    asset={selectedCrypto}
                    search={cryptoSearch}
                    setSearch={setCryptoSearch}
                    open={cryptoOpen}
                    setOpen={setCryptoOpen}
                    onSelect={setSelectedCrypto}
                  />

                  {!cryptoOpen && (
                    <>
                      <button type="button" className="flex h-14 w-full items-center justify-between rounded-2xl bg-white/[0.06] px-5 text-left ring-1 ring-white/[0.08]" disabled>
                        <span className="text-base font-black text-white">{selectedCrypto.network}</span>
                        <Icon name="expand_more" className="text-[26px] text-slate-500" />
                      </button>

                      <div className="rounded-2xl bg-white/[0.04] px-5 py-4 text-center ring-1 ring-white/[0.08]">
                        <p className="text-sm font-bold text-slate-400">
                          Minimum <span className="font-black text-white">{selectedCrypto.code} {selectedCrypto.min}</span>
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-600">Amounts below this will not be credited.</p>
                      </div>

                      <div className="rounded-2xl border border-dashed border-[#087cff]/50 bg-[#087cff]/10 px-5 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#087cff]/18">
                            <Icon name="account_balance_wallet" fill className="text-[24px] text-[#5ea9ff]" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-white">{selectedCrypto.code} deposit address</p>
                            <p className="text-xs font-bold text-slate-500">Crypto deposits are being connected.</p>
                          </div>
                        </div>
                      </div>

                      <BonusCard />
                    </>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <button
                type="button"
                onClick={() => {
                  reset();
                  setScreen("methods");
                }}
                className="flex items-center gap-2 text-sm font-black text-[#5ea9ff] transition hover:text-white"
              >
                <Icon name="chevron_left" className="text-[24px]" />
                Back
              </button>

              <div className="flex items-center gap-4">
                <span className="text-2xl font-black tracking-tight text-[#31c45d]">M-PESA</span>
                <h2 className="text-4xl font-black tracking-tight text-white">M-pesa</h2>
              </div>

              <MoneyTabs mode={mode} setMode={setMode} />

              {deposit.step === "confirmed" ? (
                <div className="rounded-2xl bg-white/[0.06] p-6 text-center ring-1 ring-[#05b957]/30">
                  <Icon name="check_circle" fill className="mx-auto text-[54px] text-[#05b957]" />
                  <p className="mt-2 text-2xl font-black text-white">Payment received</p>
                  <p className="mt-1 text-sm font-bold text-slate-400">KSh {deposit.amount.toLocaleString()} was added to your wallet.</p>
                  <button type="button" onClick={reset} className="mt-5 h-14 w-full rounded-xl bg-[#087cff] text-base font-black text-white">
                    Deposit more
                  </button>
                </div>
              ) : deposit.step === "pending" ? (
                <div className="rounded-2xl bg-white/[0.06] p-6 text-center ring-1 ring-[#087cff]/30">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#087cff]/15">
                    <Icon name="phone_iphone" fill className="text-[34px] text-[#5ea9ff]" />
                  </div>
                  <p className="mt-3 text-2xl font-black text-white">Check your phone</p>
                  <p className="mt-1 text-sm font-bold text-slate-400">Enter your M-Pesa PIN to complete KES {deposit.amount.toLocaleString()}.</p>
                  <button type="button" onClick={reset} className="mt-5 text-sm font-bold text-slate-500 transition hover:text-white">
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
                    className="h-14 w-full rounded-2xl bg-white/[0.06] px-5 text-base font-bold text-white outline-none ring-1 ring-white/[0.08] placeholder:text-slate-600 focus:ring-2 focus:ring-[#087cff]/50"
                  />

                  <label className="relative block">
                    <span className="absolute left-5 top-2 text-xs font-bold text-slate-500">Amount</span>
                    <input
                      type="number"
                      min="150"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-14 w-full rounded-2xl bg-white/[0.06] px-5 pt-4 text-base font-bold text-white outline-none ring-1 ring-white/[0.08] focus:ring-2 focus:ring-[#087cff]/50"
                    />
                    <span className="absolute right-3 top-2 flex h-9 items-center rounded-xl bg-gradient-to-b from-[#31c45d] to-[#05a64d] px-4 text-sm font-black text-white shadow-sm">
                      Bonus
                    </span>
                  </label>

                  <p className="-mt-3 text-sm font-bold text-slate-500">from KES 150 to KES 150,000</p>

                  <div className="flex flex-wrap justify-center gap-3">
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setAmount(String(q))}
                        className={`h-10 rounded-full px-5 text-sm font-black transition ${
                          amount === String(q) ? "bg-[#087cff] text-white shadow-lg shadow-blue-500/20" : "bg-white/[0.07] text-slate-300 hover:bg-white/[0.10]"
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
                    className="h-14 w-full rounded-xl bg-[#05b957] text-base font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-[#07cc63] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? "Sending prompt..." : "Deposit"}
                  </button>

                  <BonusCard />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
