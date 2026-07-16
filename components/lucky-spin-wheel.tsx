"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { useAuthModal } from "@/lib/auth-modal-context";
import { useCurrency } from "@/lib/currency-context";
import { placed, outcomeWin, outcomeLose } from "@/lib/game-feel";
import { toast } from "@/lib/toast";
import { celebrateWin } from "@/components/aviator/win-celebration";

// Must match the server SEGMENTS in /api/wheel/spin exactly (same order/index).
const WHEEL_SEGS = [
  { label: "×0.5", mult: 0.5, fill: "#243042", text: "#cbd5e1" },
  { label: "×2",   mult: 2,   fill: "#087cff", text: "#fff"    },
  { label: "×0",   mult: 0,   fill: "#341620", text: "#fb7185" },
  { label: "×1.5", mult: 1.5, fill: "#1a3a6c", text: "#9cc9ff" },
  { label: "×3",   mult: 3,   fill: "#0060c9", text: "#fff"    },
  { label: "×0",   mult: 0,   fill: "#341620", text: "#fb7185" },
  { label: "×2",   mult: 2,   fill: "#087cff", text: "#fff"    },
  { label: "×0.5", mult: 0.5, fill: "#243042", text: "#cbd5e1" },
  { label: "×5",   mult: 5,   fill: "#c2620a", text: "#ffe6a7" },
  { label: "×0",   mult: 0,   fill: "#341620", text: "#fb7185" },
  { label: "×1.5", mult: 1.5, fill: "#1a3a6c", text: "#9cc9ff" },
  { label: "×10",  mult: 10,  fill: "#7c3aed", text: "#fff"    },
];

const N = WHEEL_SEGS.length;
const DEG = 360 / N;
const CX = 100, CY = 100, R = 92, TEXT_R = 62;
const MIN_PLAY_AMOUNT = 10;
const SPIN_MS = 3800; // decel duration once the outcome is known

function polarXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(i: number) {
  const s = polarXY(CX, CY, R, i * DEG);
  const e = polarXY(CX, CY, R, (i + 1) * DEG);
  return `M${CX},${CY} L${s.x.toFixed(2)},${s.y.toFixed(2)} A${R},${R},0,0,1,${e.x.toFixed(2)},${e.y.toFixed(2)}Z`;
}

type WheelResult = {
  segmentIndex: number;
  label: string;
  multiplier: number;
  stake: number;
  winAmount: number;
  netChange: number;
};

export function LuckySpinWheel() {
  const { isSignedIn } = useSupabaseAuth();
  const { openLogin } = useAuthModal();
  const { balance, refresh: refreshBalance } = useWalletBalance();
  const { convert, toKes, format, currency } = useCurrency();

  const [rotation, setRotation] = useState(0);
  const [spinTransition, setSpinTransition] = useState("none");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<WheelResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("50");
  const spinBaseRef = useRef(0);

  const amt = parseFloat(amount || "0");
  const amtKes = Math.round(toKes(amt));
  const notEnoughFunds = isSignedIn && amt > 0 && amtKes > balance;
  const canSpin = !!amt && amtKes >= MIN_PLAY_AMOUNT && !notEnoughFunds;

  async function spin() {
    if (!isSignedIn) { openLogin(); return; }
    if (spinning) return;
    if (amtKes < MIN_PLAY_AMOUNT) { setError(`Minimum spin is ${format(MIN_PLAY_AMOUNT)}`); return; }
    setError(null);
    setResult(null);

    // ── Instant feedback: the wheel launches the moment you tap (optimistic
    // wind-up) while we fetch the outcome — no "Placing…" freeze. When the
    // result lands we retarget to the winning segment; CSS eases smoothly from
    // the current position, so it decelerates onto the prize with no teleport.
    setSpinning(true);
    placed();
    toast.info("Spinning…", `Stake ${format(amtKes)}`);
    const windUp = rotation + 720;
    spinBaseRef.current = windUp;
    setSpinTransition(`transform 0.8s cubic-bezier(0.32,0,0.67,0.35)`);
    setRotation(windUp);

    let data: WheelResult;
    try {
      const res = await fetch("/api/wheel/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amtKes }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Spin failed");
        setSpinning(false);
        setSpinTransition("transform 0.4s ease-out");
        setRotation(spinBaseRef.current); // settle the wind-up
        return;
      }
      data = json as WheelResult;
    } catch {
      setError("Network error — please try again");
      setSpinning(false);
      setSpinTransition("transform 0.4s ease-out");
      setRotation(spinBaseRef.current);
      return;
    }

    // Land the winning segment under the top pointer, decelerating in.
    const segMid = data.segmentIndex * DEG + DEG / 2;
    const base = spinBaseRef.current;
    const finalRot = base + 4 * 360 + ((360 - ((base % 360 + segMid) % 360)) % 360);
    setSpinTransition(`transform ${SPIN_MS}ms cubic-bezier(0.16,0.84,0.20,1)`);
    setRotation(finalRot);

    setTimeout(() => {
      setSpinning(false);
      setResult(data);
      refreshBalance();
      window.dispatchEvent(new Event("wallet-refresh"));
      if (data.multiplier === 0 || data.netChange < 0) outcomeLose();
      else {
        outcomeWin();
        // Same confetti + count-up badge the rest of the app uses.
        celebrateWin({ amount: data.winAmount, multiplier: data.multiplier });
      }
    }, SPIN_MS);
  }

  const won = result && result.netChange >= 0 && result.multiplier > 0;
  const big = result && result.multiplier >= 5;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* Ambient glow behind the wheel */}
      <div className="pointer-events-none absolute left-1/2 top-[22%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#087cff]/20 blur-[70px]" />

      {/* ── Wheel ── */}
      <div className="relative z-10 flex shrink-0 items-center justify-center px-4 pt-3">
        {/* Pointer */}
        <div className="absolute -top-1 left-1/2 z-20 -translate-x-1/2 drop-shadow-[0_3px_6px_rgba(0,0,0,.7)]">
          <svg width="26" height="30" viewBox="0 0 26 30" fill="none">
            <path d="M13 30 L2 4 Q13 -4 24 4 Z" fill="#f8fafc" />
            <circle cx="13" cy="7" r="3" fill="#087cff" />
          </svg>
        </div>

        <div className="relative w-[min(74vw,300px)]">
          {/* Outer bezel */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.12] to-transparent p-[3px]">
            <div className="h-full w-full rounded-full bg-[#0b0d12] ring-1 ring-white/[0.06]" />
          </div>

          <svg
            viewBox="0 0 200 200"
            className="relative block w-full"
            style={{ transform: `rotate(${rotation}deg)`, transition: spinTransition }}
          >
            <defs>
              <radialGradient id="hub" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#2b3a52" />
                <stop offset="100%" stopColor="#0d1017" />
              </radialGradient>
              {/* Glossy 3-D sheen: a soft off-centre highlight over the whole face. */}
              <radialGradient id="wheel-sheen" cx="38%" cy="30%" r="75%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
                <stop offset="42%" stopColor="#ffffff" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
              </radialGradient>
              {/* Metallic rim gradient. */}
              <linearGradient id="wheel-rim" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#eaf2ff" />
                <stop offset="18%" stopColor="#8fb3e6" />
                <stop offset="50%" stopColor="#2b3a52" />
                <stop offset="82%" stopColor="#8fb3e6" />
                <stop offset="100%" stopColor="#dbe7fb" />
              </linearGradient>
            </defs>

            {WHEEL_SEGS.map((seg, i) => {
              const mid = i * DEG + DEG / 2;
              const isWinner = !!result && !spinning && result.segmentIndex === i;
              return (
                <g key={i} style={isWinner ? { filter: "brightness(1.35) saturate(1.2)" } : undefined}>
                  <path d={slicePath(i)} fill={seg.fill} stroke="#0b0d12" strokeWidth="1.5" />
                  {isWinner && (
                    <path d={slicePath(i)} fill="#ffffff" fillOpacity="0.12" stroke="#f5b942" strokeWidth="2.5" />
                  )}
                  <g transform={`rotate(${mid},${CX},${CY})`}>
                    <text
                      x={CX}
                      y={CY - TEXT_R}
                      fill={seg.text}
                      fontSize="11"
                      fontWeight="900"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{ userSelect: "none", fontFamily: "inherit" }}
                    >
                      {seg.label}
                    </text>
                  </g>
                  {(() => {
                    const p = polarXY(CX, CY, R - 3, i * DEG);
                    return <circle cx={p.x} cy={p.y} r="1.6" fill="#f8fafc" opacity="0.85" />;
                  })()}
                </g>
              );
            })}

            {/* Metallic rim + glossy sheen over the whole face (3-D depth). */}
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="url(#wheel-rim)" strokeWidth="4" />
            <circle cx={CX} cy={CY} r={R - 2} fill="url(#wheel-sheen)" pointerEvents="none" />

            {/* Center hub */}
            <circle cx={CX} cy={CY} r="20" fill="url(#hub)" stroke="#1e2a3a" strokeWidth="2" />
            <circle cx={CX} cy={CY} r="9" fill="#087cff" />
            <circle cx={CX} cy={CY} r="9" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="1" />
            <circle cx={CX - 2.5} cy={CY - 2.5} r="2.5" fill="#fff" opacity="0.7" />
          </svg>
        </div>
      </div>

      {/* ── Controls: full-bleed dock (edge to edge) ── */}
      <div className="relative z-10 mt-auto w-full border-t border-white/[0.08] bg-[#121316] px-4 pb-[calc(4.75rem+env(safe-area-inset-bottom))] pt-3 sm:pb-4">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2.5">
          {/* Result / status */}
          {error ? (
            <div className="w-full bg-red-500/10 px-1 py-2 text-center">
              <p className="text-[12px] font-bold text-red-400">{error}</p>
            </div>
          ) : result ? (() => {
            const noWin = result.multiplier === 0;              // ×0 — full stake lost (red)
            const partial = !won && !noWin;                     // e.g. ×0.5 — some back, net down (neutral, NOT red)
            const tone = noWin
              ? { text: "text-red-400", bg: "bg-red-500/10", ring: "ring-red-500/20" }
              : partial
                ? { text: "text-sky-300", bg: "bg-sky-500/10", ring: "ring-sky-400/20" }
                : big
                  ? { text: "text-amber-300", bg: "bg-amber-500/10", ring: "ring-amber-400/25" }
                  : { text: "text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20" };
            const heading = noWin ? "No win" : big ? "Big win" : partial ? "Partial return" : "You won";
            const amountText = noWin
              ? `−${format(result.stake)}`
              : partial
                ? `${format(result.winAmount)} back`
                : `+${format(result.netChange)}`;
            return (
              <div
                className={`mx-auto flex items-center justify-center gap-2 rounded-full px-3.5 py-1.5 ring-1 duration-300 animate-in fade-in zoom-in-95 ${tone.bg} ${tone.ring}`}
              >
                <span className={`text-[10px] font-black uppercase tracking-wider ${tone.text}`}>
                  {heading}{!noWin && ` · ${result.label}`}
                </span>
                <span className={`text-[15px] font-black tabular-nums ${tone.text}`}>{amountText}</span>
              </div>
            );
          })() : (
            <div className="flex w-full items-center justify-between px-0.5 py-1">
              <span className="text-[11px] font-bold text-slate-500">Balance</span>
              {isSignedIn ? (
                <span className="text-[14px] font-black tabular-nums text-white">{format(balance)}</span>
              ) : (
                <span className="text-[12px] font-bold text-slate-500">Log in to play</span>
              )}
            </div>
          )}

          {/* Stake input + quick multipliers */}
          <div className="w-full">
            <div
              className={`flex items-center gap-2 rounded-xl bg-black/30 px-3 py-2.5 ring-1 transition ${
                notEnoughFunds ? "ring-red-500/40" : "ring-white/[0.08] focus-within:ring-[#087cff]/50"
              }`}
            >
              <span className="shrink-0 text-[12px] font-black text-slate-500">{currency.symbol}</span>
              <input
                type="number"
                min={convert(MIN_PLAY_AMOUNT)}
                placeholder="Spin amount"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(null); }}
                className="min-w-0 flex-1 bg-transparent text-[15px] font-black tabular-nums text-white outline-none placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={() => { if (balance > 0) setAmount(String(convert(balance))); }}
                className="shrink-0 rounded-md bg-white/[0.06] px-2 py-1 text-[10px] font-black text-[#75b8ff] transition hover:bg-white/[0.12]"
              >
                MAX
              </button>
            </div>
            <div className="mt-2 flex w-full gap-1.5">
              {([1.5, 2, 3] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAmount((v) => (parseFloat(v || "0") * m).toFixed(2))}
                  className="flex-1 rounded-lg bg-white/[0.04] py-2 text-[11px] font-black text-slate-400 ring-1 ring-white/[0.06] transition hover:bg-[#087cff]/15 hover:text-[#75b8ff] active:scale-[0.97]"
                >
                  ×{m}
                </button>
              ))}
            </div>
            {notEnoughFunds && (
              <p className="mt-1.5 text-[10px] font-bold text-red-400">
                Insufficient balance — {format(balance)} available
              </p>
            )}
          </div>

          {/* Action */}
          {!isSignedIn ? (
            <button
              type="button"
              onClick={openLogin}
              className="w-full rounded-xl bg-[#087cff] py-3.5 text-sm font-black text-white transition hover:bg-[#0570e8] active:scale-[.98]"
            >
              Log in to Spin
            </button>
          ) : notEnoughFunds ? (
            <Link
              href="/wallet"
              className="flex w-full items-center justify-center rounded-xl bg-[#06c96e] py-3.5 text-sm font-black text-white transition hover:bg-[#05b85f] active:scale-[.98]"
            >
              Deposit to Spin
            </Link>
          ) : (
            <button
              type="button"
              onClick={spin}
              disabled={spinning || !canSpin}
              aria-busy={spinning}
              className="w-full rounded-xl bg-[#087cff] py-3.5 text-sm font-black text-white transition hover:bg-[#0570e8] active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {spinning ? "Spinning…" : "Spin"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
