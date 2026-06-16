"use client";

import { useEffect, useRef, useState } from "react";

interface HistoryRound {
  roundId:     string;
  roundNumber: number;
  crashPoint:  number;
  crashedAt:   string | null;
  serverSeed:  string;
  serverSeedHash: string;
  clientSeed?: string;
  nonce?:      number;
}

interface Props {
  rounds:      HistoryRound[];
  onVerify?:   (r: HistoryRound) => void;
}

function chipColor(cp: number) {
  if (cp < 1.5) return "bg-sky-600/80 text-sky-100 border-sky-400/40";
  if (cp < 2)   return "bg-blue-600/80 text-blue-100 border-blue-400/40";
  if (cp < 5)   return "bg-violet-600/80 text-violet-100 border-violet-400/40";
  if (cp < 10)  return "bg-purple-600/80 text-purple-100 border-purple-400/40";
  return              "bg-fuchsia-600/80 text-fuchsia-100 border-fuchsia-400/50";
}

function chipGlow(cp: number) {
  if (cp < 2)  return "";
  if (cp < 5)  return "shadow-sm shadow-violet-500/30";
  if (cp < 10) return "shadow-sm shadow-purple-500/40";
  return            "shadow-md shadow-fuchsia-500/50";
}

export function AviatorHistory({ rounds, onVerify }: Props) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ r: HistoryRound; x: number } | null>(null);

  // Chips render newest-first (leftmost), so snap back to the left edge whenever
  // a new round lands — that keeps the latest result in view to verify.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [rounds.length]);

  return (
    <div className="relative min-w-0 overflow-hidden">
      <div
        ref={scrollRef}
        className="no-scrollbar flex w-full min-w-0 max-w-full items-center gap-1.5 overflow-x-auto py-0.5"
        style={{ scrollBehavior: "smooth", scrollbarWidth: "none" } as React.CSSProperties}
      >
        {rounds.length === 0 && (
          <span className="px-2 text-[11px] text-white/30 italic">No rounds yet…</span>
        )}
        {[...rounds].reverse().map((r) => (
          <button
            key={r.roundId}
            onClick={() => onVerify?.(r)}
            onMouseEnter={(e) => setTooltip({ r, x: e.clientX })}
            onMouseLeave={() => setTooltip(null)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black transition-transform hover:scale-105 ${chipColor(r.crashPoint)} ${chipGlow(r.crashPoint)}`}
          >
            {r.crashPoint.toFixed(2)}x
          </button>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-gray-900 p-3 text-xs shadow-xl"
          style={{ left: tooltip.x, top: "auto", marginTop: -8 }}
        >
          <p className="mb-1 font-bold text-white">Round #{tooltip.r.roundNumber}</p>
          <p className="text-white/60">Crash: <span className="text-white">{tooltip.r.crashPoint.toFixed(2)}x</span></p>
          {tooltip.r.crashedAt && (
            <p className="text-white/40 text-[10px]">{new Date(tooltip.r.crashedAt).toLocaleTimeString()}</p>
          )}
          <p className="mt-1 text-[10px] text-white/30">Click to verify fairness</p>
        </div>
      )}
    </div>
  );
}

/* ── Provably Fair Verify Modal ─────────────────────────────────────────── */

interface VerifyModalProps {
  round:    HistoryRound;
  onClose:  () => void;
}

export function VerifyModal({ round, onClose }: VerifyModalProps) {
  const [verified, setVerified] = useState<boolean | null>(null);
  const [computed, setComputed] = useState<number | null>(null);

  const handleVerify = async () => {
    // Dynamic import so this only runs client-side
    const { generateCrashPoint, hashServerSeed } = await import("@/lib/aviator/fair");
    const hash    = hashServerSeed(round.serverSeed);
    const matches = hash === round.serverSeedHash;
    // HMAC input is `${clientSeed}:${nonce}` — nonce falls back to the roundId suffix.
    const nonce      = round.nonce ?? Number(round.roundId.split("-").at(-1));
    const clientSeed = round.clientSeed ?? "";
    if (!clientSeed || !Number.isFinite(nonce)) {
      setComputed(null);
      setVerified(false);
      return;
    }
    const cp = generateCrashPoint(round.serverSeed, clientSeed, nonce);
    setComputed(cp);
    setVerified(matches && Math.abs(cp - round.crashPoint) < 0.01);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-white">Provably Fair Verification</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <p className="mb-1 text-white/50">Round #{round.roundNumber}</p>
          </div>
          <div>
            <p className="mb-1 font-semibold text-white/70">Server Seed (revealed after crash)</p>
            <code className="block break-all rounded-md bg-black/40 p-2 font-mono text-green-400">{round.serverSeed}</code>
          </div>
          <div>
            <p className="mb-1 font-semibold text-white/70">SHA-256 Hash (shown before round)</p>
            <code className="block break-all rounded-md bg-black/40 p-2 font-mono text-blue-400">{round.serverSeedHash}</code>
          </div>
          <div>
            <p className="mb-1 font-semibold text-white/70">Client Seed</p>
            <code className="block break-all rounded-md bg-black/40 p-2 font-mono text-amber-300">{round.clientSeed ?? "(not available for this round)"}</code>
          </div>
          <div>
            <p className="mb-1 font-semibold text-white/70">HMAC input</p>
            <code className="block break-all rounded-md bg-black/40 p-2 font-mono text-white/60">{`${round.clientSeed ?? "?"}:${round.nonce ?? round.roundId.split("-").at(-1)}`}</code>
          </div>

          {computed !== null && (
            <div className={`rounded-lg border p-3 ${verified ? "border-green-500/30 bg-green-950/30" : "border-red-500/30 bg-red-950/30"}`}>
              <p className={`font-bold ${verified ? "text-green-400" : "text-red-400"}`}>
                {verified ? "✅ VERIFIED — Crash point matches!" : "❌ MISMATCH — Something is wrong"}
              </p>
              <p className="mt-1 text-white/60">
                Computed crash point: <span className="font-mono font-bold text-white">{computed.toFixed(2)}x</span>
                {" "}| Actual: <span className="font-mono font-bold text-white">{round.crashPoint.toFixed(2)}x</span>
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={handleVerify}
            className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-500"
          >
            Verify Now
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/10 py-2.5 text-sm font-semibold text-white/60 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
