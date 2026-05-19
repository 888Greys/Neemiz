"use client";

import { useEffect, useRef, useState } from "react";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { Icon } from "@/components/icon";

const QUICK_AMOUNTS = [400, 1_000, 3_000, 5_000];
const POLL_INTERVAL = 4_000;
const MAX_POLLS = 30;

type DepositState =
  | { step: "idle" }
  | { step: "pending"; txId: string; amount: number }
  | { step: "confirmed"; amount: number; newBalance: number; receipt: string }
  | { step: "failed"; message: string };

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
    <div className="grid grid-cols-2 rounded-2xl bg-[#eef0f2] p-1">
      <button
        type="button"
        onClick={() => setMode("fiat")}
        className={`flex h-12 items-center justify-center gap-3 rounded-xl text-base font-black transition ${
          mode === "fiat" ? "bg-[#dfe1e5] text-[#111318] shadow-sm" : "text-[#111318]"
        }`}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#098445] text-[13px] font-black text-white">$</span>
        Fiat
      </button>
      <button
        type="button"
        onClick={() => setMode("crypto")}
        className={`flex h-12 items-center justify-center gap-3 rounded-xl text-base font-black transition ${
          mode === "crypto" ? "bg-[#dfe1e5] text-[#111318] shadow-sm" : "text-[#111318]"
        }`}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ff9811] text-[13px] font-black text-white">B</span>
        Crypto
      </button>
    </div>
  );
}

function BonusCard() {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xl font-black text-[#17191d]">Deposit bonus</p>
        <div className="flex items-center gap-2 text-sm font-medium text-[#6d727c]">
          Without bonus
          <span className="flex h-8 w-12 items-center rounded-full bg-[#edf0f2] p-1">
            <span className="h-6 w-6 rounded-full bg-white shadow-sm" />
          </span>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-2xl border-2 border-[#09bd62] bg-gradient-to-br from-[#ffbd72] via-[#ff8245] to-[#ff4c10] px-4 py-4 text-white shadow-sm">
        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#09bd62] ring-2 ring-white">
          <Icon name="check" className="text-[17px] text-white" />
        </div>
        <div className="max-w-[65%]">
          <p className="text-base font-black">+130% on the first deposit</p>
          <p className="mt-1 text-sm font-bold leading-snug">Deposit at least USD 10 and receive the bonus</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-black">
            28d : 09h : 49m : 27s
            <Icon name="info" fill className="text-[16px]" />
          </div>
        </div>
        <div className="absolute bottom-2 right-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-white/15 text-white">
          <Icon name="redeem" fill className="text-[62px]" />
        </div>
      </div>
    </div>
  );
}

function CryptoList({ open }: { open: boolean }) {
  if (!open) return null;
  const coins = [
    { name: "Bitcoin", code: "BTC", color: "bg-[#ff9811]", letter: "B" },
    { name: "Ethereum", code: "ETH", color: "bg-[#8792dd]", letter: "E" },
    { name: "Litecoin", code: "LTC", color: "bg-[#c7c7cb]", letter: "L" },
  ];

  return (
    <div className="-mt-2 rounded-b-2xl bg-white px-4 pb-2 pt-3 shadow-[0_12px_18px_rgba(15,23,42,0.12)] ring-1 ring-black/5">
      <div className="mb-2 flex h-14 items-center gap-3 rounded-xl bg-[#f0f1f3] px-4 text-[#626976]">
        <Icon name="search" className="text-[25px]" />
        <span className="text-lg">Search</span>
      </div>
      {coins.map((coin) => (
        <button key={coin.code} type="button" className="flex w-full items-center gap-4 border-b border-black/5 px-1 py-4 text-left last:border-b-0">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${coin.color} text-xs font-black text-white`}>{coin.letter}</span>
          <span>
            <span className="block text-lg font-medium text-[#25272d]">{coin.name}</span>
            <span className="block text-base text-[#737986]">{coin.code}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function WalletModal({ onClose }: Props) {
  const { isSignedIn, user } = useSupabaseAuth();
  const [mode, setMode] = useState<"fiat" | "crypto">("fiat");
  const [screen, setScreen] = useState<"methods" | "mpesa">("methods");
  const [cryptoOpen, setCryptoOpen] = useState(false);
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
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/82 px-3 py-4 sm:px-6 sm:py-8" onClick={onClose}>
      <div
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[490px] flex-col overflow-hidden rounded-[28px] bg-white text-[#111318] shadow-2xl animate-in fade-in zoom-in-95 duration-200 sm:max-h-[calc(100dvh-4rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full text-[#6e7480] transition hover:bg-black/5 hover:text-[#111318]"
          aria-label="Close wallet"
        >
          <Icon name="close" className="text-[28px]" />
        </button>

        <div className="no-scrollbar overflow-y-auto px-6 pb-8 pt-8 sm:px-6">
          {screen === "methods" ? (
            <div className="space-y-5">
              <h2 className="pr-10 text-4xl font-black tracking-tight text-[#090b10]">Deposit</h2>
              <MoneyTabs mode={mode} setMode={setMode} />

              {mode === "fiat" ? (
                <>
                  <button type="button" className="flex h-14 w-full items-center justify-between rounded-2xl bg-[#eef0f2] px-5 text-left" disabled>
                    <span className="flex items-center gap-3 text-lg text-[#111318]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-[11px] font-black text-white">KSh</span>
                      Kenyan shilling
                    </span>
                    <Icon name="expand_more" className="text-[28px] text-[#747b86]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScreen("mpesa");
                      setMode("fiat");
                    }}
                    className="flex h-[100px] w-[215px] flex-col items-start justify-between rounded-2xl bg-[#eef0f2] px-4 py-5 text-left transition hover:bg-[#e5e7ea] active:scale-[0.99]"
                  >
                    <span className="text-2xl font-black tracking-tight text-[#2fb44a]">M-PESA</span>
                    <span className="text-base font-black text-[#090b10]">M-pesa</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setCryptoOpen((open) => !open)}
                    className="flex h-14 w-full items-center justify-between rounded-2xl bg-[#eef0f2] px-5 text-left"
                  >
                    <span className="flex items-center gap-3 text-lg text-[#111318]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#5abfae] text-sm font-black text-white">T</span>
                      USDT
                    </span>
                    <Icon name={cryptoOpen ? "expand_less" : "expand_more"} className="text-[28px] text-[#747b86]" />
                  </button>
                  <CryptoList open={cryptoOpen} />
                  {!cryptoOpen && (
                    <>
                      <button type="button" className="flex h-14 w-full items-center justify-between rounded-2xl bg-[#eef0f2] px-5 text-left" disabled>
                        <span className="text-lg text-[#646a75]">TRC-20</span>
                        <Icon name="expand_more" className="text-[28px] text-[#747b86]" />
                      </button>
                      <p className="py-1 text-center text-lg text-[#5d636d]">
                        Minimum <span className="font-black text-[#111318]">USDT 5</span>
                        <br />
                        Amounts below this will not be credited.
                      </p>
                      <div className="rounded-2xl bg-[#eef0f2] px-5 py-5 text-center">
                        <p className="text-lg font-black">Crypto deposit address</p>
                        <p className="mt-2 text-sm font-bold text-[#68707c]">Crypto deposits are not connected yet.</p>
                      </div>
                      <BonusCard />
                    </>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between pr-10">
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setScreen("methods");
                  }}
                  className="flex items-center gap-2 text-lg font-bold text-[#0674ff]"
                >
                  <Icon name="chevron_left" className="text-[26px]" />
                  Back
                </button>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-2xl font-black tracking-tight text-[#2fb44a]">M-PESA</span>
                <h2 className="text-4xl font-black tracking-tight text-[#17191d]">M-pesa</h2>
              </div>

              <MoneyTabs mode={mode} setMode={setMode} />

              {deposit.step === "confirmed" ? (
                <div className="rounded-2xl bg-[#eef0f2] p-6 text-center">
                  <Icon name="check_circle" fill className="mx-auto text-[54px] text-[#09bd62]" />
                  <p className="mt-2 text-2xl font-black">Payment received</p>
                  <p className="mt-1 text-[#626976]">KSh {deposit.amount.toLocaleString()} was added to your wallet.</p>
                  <button type="button" onClick={reset} className="mt-5 h-14 w-full rounded-xl bg-[#08bd5a] text-lg font-black text-white">
                    Deposit more
                  </button>
                </div>
              ) : deposit.step === "pending" ? (
                <div className="rounded-2xl bg-[#eef0f2] p-6 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white">
                    <Icon name="phone_iphone" fill className="text-[34px] text-[#0674ff]" />
                  </div>
                  <p className="mt-3 text-2xl font-black">Check your phone</p>
                  <p className="mt-1 text-[#626976]">Enter your M-Pesa PIN to complete KES {deposit.amount.toLocaleString()}.</p>
                  <button type="button" onClick={reset} className="mt-5 text-sm font-bold text-[#626976]">
                    Cancel
                  </button>
                </div>
              ) : deposit.step === "failed" ? (
                <div className="rounded-2xl bg-red-50 p-5 text-center">
                  <Icon name="error" fill className="mx-auto text-[42px] text-red-500" />
                  <p className="mt-2 text-xl font-black">Payment failed</p>
                  <p className="mt-1 text-sm font-semibold text-red-600">{deposit.message}</p>
                  <button type="button" onClick={reset} className="mt-5 h-12 w-full rounded-xl bg-[#111318] text-base font-black text-white">
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
                    className="h-14 w-full rounded-2xl bg-[#eef0f2] px-5 text-lg font-medium text-[#111318] outline-none placeholder:text-[#5f6671] focus:ring-2 focus:ring-[#0674ff]/25"
                  />

                  <label className="relative block">
                    <span className="absolute left-5 top-2 text-xs font-medium text-[#626976]">Amount</span>
                    <input
                      type="number"
                      min="150"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-14 w-full rounded-2xl bg-[#eef0f2] px-5 pt-4 text-lg font-medium text-[#111318] outline-none focus:ring-2 focus:ring-[#0674ff]/25"
                    />
                    <span className="absolute right-3 top-2 flex h-9 items-center rounded-xl bg-gradient-to-b from-[#ff8d57] to-[#ff3e00] px-4 text-base font-black text-white shadow-sm">
                      Bonus
                    </span>
                  </label>

                  <p className="-mt-3 text-base font-medium text-[#626976]">from KES 150 to KES 150,000</p>

                  <div className="flex flex-wrap justify-center gap-3">
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setAmount(String(q))}
                        className={`h-10 rounded-full px-5 text-lg font-black transition ${
                          amount === String(q) ? "bg-[#dfe1e5] text-[#111318]" : "bg-[#eef0f2] text-[#1c1f25] hover:bg-[#e5e7ea]"
                        }`}
                      >
                        KES {q.toLocaleString()}
                      </button>
                    ))}
                  </div>

                  {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}

                  <button
                    type="button"
                    onClick={handleDeposit}
                    disabled={loading || !amount || !phone}
                    className="h-14 w-full rounded-xl bg-[#08bd5a] text-lg font-black text-white shadow-sm transition hover:bg-[#07aa51] disabled:cursor-not-allowed disabled:opacity-50"
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
