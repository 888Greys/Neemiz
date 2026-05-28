"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { Icon } from "@/components/icon";

const QUICK_AMOUNTS = [400, 1_000, 3_000, 5_000];
const POLL_INTERVAL = 4_000;
const MAX_POLLS = 30;

const COIN_ICON_URL: Record<string, string> = {
  USDT: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdt.svg",
  USDC: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdc.svg",
  BTC:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/btc.svg",
  ETH:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/eth.svg",
  BNB:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/bnb.svg",
  MATIC:"https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/matic.svg",
  TRX:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/trx.svg",
  DAI:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/dai.svg",
  BUSD: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/busd.svg",
  WBTC: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/wbtc.svg",
  LINK: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/link.svg",
};

const CRYPTO_ASSETS = [
  { name: "Tether USD",      code: "USDT",  network: "TRC20",   displayNet: "TRC-20 (Tron)",    min: 10     },
  { name: "Tether USD",      code: "USDT",  network: "ERC20",   displayNet: "ERC-20 (ETH)",     min: 10     },
  { name: "Tether USD",      code: "USDT",  network: "BEP20",   displayNet: "BEP-20 (BSC)",     min: 10     },
  { name: "USD Coin",        code: "USDC",  network: "ERC20",   displayNet: "ERC-20 (ETH)",     min: 10     },
  { name: "USD Coin",        code: "USDC",  network: "POLYGON", displayNet: "Polygon",          min: 10     },
  { name: "Ethereum",        code: "ETH",   network: "ERC20",   displayNet: "ERC-20 (ETH)",     min: 0.001  },
  { name: "BNB",             code: "BNB",   network: "BEP20",   displayNet: "BEP-20 (BSC)",     min: 0.005  },
  { name: "Polygon",         code: "MATIC", network: "POLYGON", displayNet: "Polygon",          min: 1      },
  { name: "TRON",            code: "TRX",   network: "TRC20",   displayNet: "TRC-20 (Tron)",    min: 10     },
  { name: "Dai",             code: "DAI",   network: "ERC20",   displayNet: "ERC-20 (ETH)",     min: 10     },
  { name: "Binance USD",     code: "BUSD",  network: "BEP20",   displayNet: "BEP-20 (BSC)",     min: 10     },
  { name: "Wrapped Bitcoin", code: "WBTC",  network: "ERC20",   displayNet: "ERC-20 (ETH)",     min: 0.0001 },
  { name: "Chainlink",       code: "LINK",  network: "ERC20",   displayNet: "ERC-20 (ETH)",     min: 0.5    },
];

type DepositState =
  | { step: "idle" }
  | { step: "pending"; txId: string; amount: number }
  | { step: "confirmed"; amount: number; newBalance: number; receipt: string }
  | { step: "failed"; message: string };

type CryptoAddrState =
  | { phase: "checking" }
  | { phase: "form"; error?: string }
  | { phase: "generating" }
  | { phase: "ready"; address: string };

type CryptoAsset = (typeof CRYPTO_ASSETS)[number];
type Props = { onClose: () => void; onDepositConfirmed?: () => void };

function normalizeMsisdn(v: string) {
  const s = v.trim().replace(/\s+/g, "");
  if (s.startsWith("+254")) return s.slice(1);
  if (s.startsWith("254")) return s;
  if (s.startsWith("0") && s.length === 10) return `254${s.slice(1)}`;
  return s;
}

function MoneyTabs({ mode, setMode }: { mode: "fiat" | "crypto"; setMode: (m: "fiat" | "crypto") => void }) {
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
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ff9811] text-[11px] font-black text-white">₿</span>
        Crypto
      </button>
    </div>
  );
}

function AssetIcon({ asset }: { asset: CryptoAsset }) {
  const url = COIN_ICON_URL[asset.code];
  if (url) {
    return (
      <img src={url} alt={asset.code} width={32} height={32} className="h-8 w-8 shrink-0 rounded-full" />
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-black text-white">
      {asset.code[0]}
    </span>
  );
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
  setSearch: (v: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSelect: (a: CryptoAsset) => void;
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CRYPTO_ASSETS;
    return CRYPTO_ASSETS.filter(
      (item) => item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q),
    );
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
          <span className="text-xs font-bold text-slate-500">{asset.displayNet}</span>
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
                key={`${item.code}:${item.network}`}
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
                  <span className="block text-xs font-bold text-slate-500">
                    {item.code} · {item.displayNet}
                  </span>
                </span>
                {asset.code === item.code && asset.network === item.network && (
                  <Icon name="check_circle" fill className="text-[20px] text-[#05b957]" />
                )}
              </button>
            ))}
            {!filtered.length && (
              <p className="px-3 py-8 text-center text-sm font-bold text-slate-500">No coins found</p>
            )}
          </div>
        </div>
      )}
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
  addrState,
  onGenerate,
  onCopy,
  copied,
}: {
  asset: CryptoAsset;
  search: string;
  setSearch: (v: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSelect: (a: CryptoAsset) => void;
  addrState: CryptoAddrState;
  onGenerate: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="space-y-5">
      <CryptoSelector
        asset={asset}
        search={search}
        setSearch={setSearch}
        open={open}
        setOpen={setOpen}
        onSelect={onSelect}
      />

      {!open && (
        <>
          {/* Network badge */}
          <div className="flex h-11 w-full items-center justify-between rounded-xl bg-white/[0.06] px-4 ring-1 ring-white/[0.08]">
            <span className="text-sm font-black text-white">{asset.displayNet}</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-400">
              {asset.network}
            </span>
          </div>

          <p className="-mt-2 text-xs font-bold text-slate-500">
            Minimum deposit: <span className="text-white">{asset.min} {asset.code}</span>
            <span className="ml-1 text-slate-600">· amounts below will not be credited</span>
          </p>

          {/* Address panel */}
          {addrState.phase === "checking" ? (
            <div className="flex items-center justify-center gap-3 rounded-2xl bg-white/[0.06] py-6 ring-1 ring-white/[0.08]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-[#087cff]" />
              <span className="text-xs font-bold text-slate-500">Checking for existing address…</span>
            </div>
          ) : addrState.phase === "form" || addrState.phase === "generating" ? (
            <div className="space-y-3 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/[0.08]">
              {addrState.phase === "form" && addrState.error && (
                <p className="text-xs font-bold text-red-400">{addrState.error}</p>
              )}
              <button
                type="button"
                onClick={onGenerate}
                disabled={addrState.phase === "generating"}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#087cff] text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#1990ff] disabled:opacity-60"
              >
                {addrState.phase === "generating" ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Icon name="qr_code" className="text-[16px]" />
                    Get deposit address
                  </>
                )}
              </button>
            </div>
          ) : (
            /* ready */
            <div className="flex flex-col gap-3 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/[0.08] sm:flex-row sm:items-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(addrState.address)}&bgcolor=ffffff&color=000000&margin=8&qzone=1`}
                alt="Deposit QR code"
                width={88}
                height={88}
                className="h-22 w-22 shrink-0 self-center rounded-lg"
              />
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-sm font-black text-white">Deposit address</p>
                <p className="mt-1.5 break-all font-mono text-[11px] leading-relaxed text-slate-400">
                  <span className="font-black text-white">{addrState.address.slice(0, 6)}</span>
                  {addrState.address.slice(6, -5)}
                  <span className="font-black text-white">{addrState.address.slice(-5)}</span>
                </p>
                <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-400/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Detected automatically · credited within 1–5 min
                </p>
                <button
                  type="button"
                  onClick={onCopy}
                  className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#087cff] px-4 text-xs font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#1990ff]"
                >
                  <Icon name={copied ? "check" : "content_copy"} className="text-[16px]" />
                  {copied ? "Copied!" : "Copy address"}
                </button>
              </div>
            </div>
          )}

          {addrState.phase === "ready" && (
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-400/8 px-4 py-3 ring-1 ring-amber-400/15">
              <Icon name="info" fill className="mt-0.5 shrink-0 text-[16px] text-amber-400" />
              <p className="text-xs font-bold text-amber-300/80">
                Send only <strong>{asset.code}</strong> on the{" "}
                <strong>{asset.displayNet}</strong> network to this address. Sending other
                assets may result in permanent loss.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function WalletModal({ onClose, onDepositConfirmed }: Props) {
  const { isSignedIn, user } = useSupabaseAuth();
  const [mode, setMode] = useState<"fiat" | "crypto">("fiat");
  const [screen, setScreen] = useState<"methods" | "mpesa" | "pesapal">("methods");

  // Crypto deposit state
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoAsset>(CRYPTO_ASSETS[0]);
  const [cryptoOpen, setCryptoOpen] = useState(false);
  const [cryptoSearch, setCryptoSearch] = useState("");
  const [cryptoAddr, setCryptoAddr] = useState<CryptoAddrState>({ phase: "checking" });
  const [copiedAddr, setCopiedAddr] = useState(false);

  // Fiat deposit state
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deposit, setDeposit] = useState<DepositState>({ step: "idle" });

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);

  // Pre-fill phone from profile
  useEffect(() => {
    const ph = user?.phone ?? user?.user_metadata?.phone_number;
    if (ph && !phone) setPhone(String(ph).replace("+", ""));
  }, [user, phone]);

  // Check for an existing pending deposit address whenever coin changes
  const checkCryptoAddr = useCallback(async (crypto: string, network: string) => {
    setCryptoAddr({ phase: "checking" });
    try {
      const res  = await fetch(`/api/crypto/address?crypto=${crypto}&network=${network}`);
      const data = await res.json();
      if (data?.address) {
        setCryptoAddr({ phase: "ready", address: data.address as string });
      } else {
        setCryptoAddr({ phase: "form" });
      }
    } catch {
      setCryptoAddr({ phase: "form" });
    }
  }, []);

  useEffect(() => {
    checkCryptoAddr(selectedCrypto.code, selectedCrypto.network);
  }, [selectedCrypto.code, selectedCrypto.network, checkCryptoAddr]);

  async function generateCryptoAddress() {
    setCryptoAddr({ phase: "generating" });
    try {
      const res  = await fetch("/api/crypto/address", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ crypto: selectedCrypto.code, network: selectedCrypto.network }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to generate address");
      setCryptoAddr({ phase: "ready", address: data.address as string });
    } catch (err: unknown) {
      setCryptoAddr({
        phase: "form",
        error: err instanceof Error ? err.message : "Failed to generate address",
      });
    }
  }

  async function copyCryptoAddress() {
    if (cryptoAddr.phase !== "ready") return;
    try {
      await navigator.clipboard.writeText(cryptoAddr.address);
      setCopiedAddr(true);
      window.setTimeout(() => setCopiedAddr(false), 1500);
    } catch {
      setCopiedAddr(false);
    }
  }

  // M-Pesa deposit polling
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
        const res  = await fetch("/api/wallet/deposit/status", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ transactionRequestId: txId }),
        });
        const data = await res.json();
        if (data.status === "confirmed") {
          clearInterval(pollRef.current!);
          setDeposit({
            step:       "confirmed",
            amount:     (data.amount as number) ?? deposit.amount,
            newBalance: data.newBalance as number,
            receipt:    (data.receipt as string) ?? "",
          });
          onDepositConfirmed?.();
        } else if (data.status === "failed") {
          clearInterval(pollRef.current!);
          setDeposit({ step: "failed", message: (data.message as string) ?? "Payment failed." });
        }
      } catch { /* keep polling */ }
    }, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [deposit, onDepositConfirmed]);

  function reset() {
    setDeposit({ step: "idle" });
    setError("");
    pollCount.current = 0;
  }

  async function handleDeposit() {
    if (!isSignedIn) { setError("Log in to deposit."); return; }
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/wallet/deposit/megapay", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amount: Number(amount), phone: normalizeMsisdn(phone) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to initiate payment.");
      setDeposit({ step: "pending", txId: (data as { transactionId: string }).transactionId, amount: Number(amount) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePesapalCheckout() {
    if (!isSignedIn) { setError("Log in to deposit."); return; }
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/wallet/pesapal/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amountKes: Number(amount) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to initiate payment.");
      window.location.href = (data as { redirectUrl: string }).redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const cryptoPanelProps = {
    asset:      selectedCrypto,
    search:     cryptoSearch,
    setSearch:  setCryptoSearch,
    open:       cryptoOpen,
    setOpen:    setCryptoOpen,
    onSelect:   (a: CryptoAsset) => { setSelectedCrypto(a); setCryptoOpen(false); },
    addrState:  cryptoAddr,
    onGenerate: generateCryptoAddress,
    onCopy:     copyCryptoAddress,
    copied:     copiedAddr,
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/72 px-3 py-6 backdrop-blur-md sm:px-6 sm:py-8"
      onClick={onClose}
    >
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
          {screen === "pesapal" ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => { reset(); setScreen("methods"); }}
                className="inline-flex h-9 items-center gap-1 rounded-full bg-white/[0.05] pl-2 pr-4 text-sm font-black text-[#75b8ff] ring-1 ring-white/[0.07] transition hover:bg-white/[0.09] hover:text-white"
              >
                <Icon name="chevron_left" className="text-[22px]" />
                Back
              </button>

              <div className="pr-12">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-400/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-300 ring-1 ring-blue-400/20">
                  <span className="h-2 w-2 rounded-full bg-[#087cff]" />
                  Pesapal
                </div>
                <h2 className="mt-3 text-xl font-black tracking-tight text-white">Hosted checkout</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  Pay with M-Pesa, Visa, Mastercard or mobile money via Pesapal.
                </p>
              </div>

              <label className="relative block">
                <span className="absolute left-5 top-2 text-xs font-bold text-slate-500">Amount (KES)</span>
                <input
                  type="number"
                  min="10"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="h-14 w-full rounded-2xl bg-white/[0.055] px-5 pt-4 text-base font-bold text-white outline-none ring-1 ring-white/[0.08] transition focus:bg-white/[0.075] focus:ring-2 focus:ring-[#087cff]/50 placeholder:text-slate-600"
                  autoFocus
                />
              </label>

              <p className="-mt-2 text-xs font-bold text-slate-500">Minimum KES 10</p>

              <div className="grid grid-cols-4 gap-2">
                {QUICK_AMOUNTS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(String(v))}
                    className={`h-9 rounded-xl text-xs font-black transition ${
                      Number(amount) === v
                        ? "bg-[#087cff] text-white"
                        : "bg-white/[0.06] text-slate-400 ring-1 ring-white/[0.08] hover:bg-white/[0.10] hover:text-white"
                    }`}
                  >
                    {v.toLocaleString()}
                  </button>
                ))}
              </div>

              {error && (
                <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 ring-1 ring-red-500/20">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handlePesapalCheckout}
                disabled={loading || !amount || Number(amount) < 10}
                className="h-14 w-full rounded-2xl bg-[#087cff] text-base font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#1990ff] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-slate-500 disabled:shadow-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Redirecting…
                  </span>
                ) : (
                  "Continue to payment →"
                )}
              </button>

              <p className="text-center text-[10px] font-bold text-slate-600">
                You will be redirected to Pesapal to complete your payment securely.
              </p>
            </div>
          ) : screen === "methods" ? (
            <div className="space-y-3 sm:space-y-5">
              <div>
                <h2 className="pr-10 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Deposit
                </h2>
                <p className="mt-1 text-xs font-bold text-slate-500 sm:text-sm">
                  Choose how you want to fund your Nezeem wallet.
                </p>
              </div>

              <MoneyTabs mode={mode} setMode={setMode} />

              {mode === "fiat" ? (
                <>
                  <button
                    type="button"
                    className="flex h-12 w-full items-center justify-between rounded-2xl bg-white/[0.06] px-4 text-left ring-1 ring-white/[0.08]"
                    disabled
                  >
                    <span className="flex items-center gap-3 text-base font-black text-white">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white">
                        KSh
                      </span>
                      Kenyan shilling
                    </span>
                    <Icon name="expand_more" className="text-[26px] text-slate-500" />
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => { setScreen("mpesa"); setMode("fiat"); }}
                      className="flex h-[100px] flex-col items-start justify-between rounded-2xl bg-white/[0.06] px-4 py-4 text-left ring-1 ring-white/[0.08] transition hover:bg-white/[0.10] active:scale-[0.99]"
                    >
                      <span className="text-xl font-black tracking-tight text-[#31c45d]">M-PESA</span>
                      <span>
                        <span className="block text-sm font-black text-white">M-Pesa</span>
                        <span className="block text-xs font-bold text-slate-500">Instant STK push</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setScreen("pesapal"); setMode("fiat"); reset(); }}
                      className="flex h-[100px] flex-col items-start justify-between rounded-2xl bg-white/[0.06] px-4 py-4 text-left ring-1 ring-white/[0.08] transition hover:bg-white/[0.10] active:scale-[0.99]"
                    >
                      <span className="text-xl font-black tracking-tight text-[#087cff]">Pesapal</span>
                      <span>
                        <span className="block text-sm font-black text-white">Card · M-Pesa</span>
                        <span className="block text-xs font-bold text-slate-500">Hosted checkout</span>
                      </span>
                    </button>
                  </div>
                </>
              ) : (
                <CryptoDepositPanel {...cryptoPanelProps} />
              )}
            </div>
          ) : (
            /* ── mpesa / crypto screen ── */
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => { reset(); setScreen("methods"); }}
                className="inline-flex h-9 items-center gap-1 rounded-full bg-white/[0.05] pl-2 pr-4 text-sm font-black text-[#75b8ff] ring-1 ring-white/[0.07] transition hover:bg-white/[0.09] hover:text-white"
              >
                <Icon name="chevron_left" className="text-[22px]" />
                Back
              </button>

              {mode === "crypto" ? (
                <div className="pr-12">
                  <h2 className="text-3xl font-black tracking-tight text-white">Crypto deposit</h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    Choose an asset and send only on the selected network.
                  </p>
                </div>
              ) : (
                <div className="pr-12">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-400/20">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    M-Pesa
                  </div>
                  <h2 className="mt-3 text-xl font-black tracking-tight text-white">Deposit by phone</h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    Enter your Safaricom number and approve the STK prompt.
                  </p>
                </div>
              )}

              <MoneyTabs mode={mode} setMode={setMode} />

              {mode === "crypto" ? (
                <CryptoDepositPanel {...cryptoPanelProps} />
              ) : deposit.step === "confirmed" ? (
                <div className="rounded-2xl bg-white/[0.06] p-6 text-center ring-1 ring-[#05b957]/30">
                  <Icon name="check_circle" fill className="mx-auto text-[54px] text-[#05b957]" />
                  <p className="mt-2 text-3xl font-black text-white">Success</p>
                  <p className="mt-1 text-sm font-bold text-slate-400">
                    Payment confirmed. KSh {deposit.amount.toLocaleString()} was added to your wallet.
                  </p>
                  <button
                    type="button"
                    onClick={reset}
                    className="mt-5 h-14 w-full rounded-xl bg-[#087cff] text-base font-black text-white"
                  >
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
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      Approve the M-Pesa prompt on your phone
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={reset}
                    className="text-xs font-bold text-slate-600 transition hover:text-slate-400"
                  >
                    Cancel
                  </button>
                </div>
              ) : deposit.step === "failed" ? (
                <div className="rounded-2xl bg-red-500/10 p-5 text-center ring-1 ring-red-500/25">
                  <Icon name="error" fill className="mx-auto text-[42px] text-red-400" />
                  <p className="mt-2 text-xl font-black text-white">Payment failed</p>
                  <p className="mt-1 text-sm font-semibold text-red-300">{deposit.message}</p>
                  <button
                    type="button"
                    onClick={reset}
                    className="mt-5 h-12 w-full rounded-xl bg-white/[0.08] text-base font-black text-white ring-1 ring-white/[0.08]"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="tel"
                    autoFocus
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
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="h-14 w-full rounded-2xl bg-white/[0.055] px-5 pt-4 text-base font-bold text-white outline-none ring-1 ring-white/[0.08] transition focus:bg-white/[0.075] focus:ring-2 focus:ring-[#087cff]/50 placeholder:text-slate-600"
                    />
                  </label>

                  <p className="-mt-2 text-xs font-bold text-slate-500">KES 10 – KES 150,000</p>

                  {error && (
                    <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 ring-1 ring-red-500/20">
                      {error}
                    </p>
                  )}

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
