"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useCurrency } from "@/lib/currency-context";
import { toast } from "@/lib/toast";

export type WinCelebrationTier = "default" | "big";

export type WinCelebrationPayload = {
  multiplier?: number; // optional — games without a clean multiplier (forex) omit it
  amount: number; // canonical KES
  tier?: WinCelebrationTier;
  label?: string; // small caption above the amount (default "You won!")
  /** Top toast title — same style as "RISE placed". Defaults to `label` / "You won!". */
  toastTitle?: string;
  toastDescription?: string;
};

export type WinCelebrationHandle = {
  fire: (payload: WinCelebrationPayload) => void;
};

type Badge = WinCelebrationPayload & {
  id: string;
  tier: WinCelebrationTier;
};

const BIG_MULT = 10;
const BIG_AMOUNT_KES = 5_000;

function resolveTier(p: WinCelebrationPayload): WinCelebrationTier {
  if (p.tier) return p.tier;
  if ((p.multiplier ?? 0) >= BIG_MULT || p.amount >= BIG_AMOUNT_KES) return "big";
  return "default";
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useCountUp(target: number, active: boolean, ms: number, reduced: boolean): number {
  const [value, setValue] = useState(reduced || !active ? target : 0);
  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setValue(target);
      return;
    }
    setValue(0);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      // ease-out cubic
      const e = 1 - Math.pow(1 - t, 3);
      setValue(target * e);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, ms, reduced]);
  return value;
}

function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;
  const bits = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bits.map((i) => {
        const left = 10 + ((i * 37) % 80);
        const delay = (i % 6) * 40;
        const hue = (i * 47) % 360;
        const dx = ((i * 13) % 40) - 20;
        return (
          <span
            key={i}
            className="aviator-confetti absolute top-[28%] h-1.5 w-1.5 rounded-sm"
            style={{
              left: `${left}%`,
              background: `hsl(${hue} 80% 55%)`,
              animationDelay: `${delay}ms`,
              ["--dx" as string]: `${dx}px`,
            }}
          />
        );
      })}
    </div>
  );
}

function WinBadge({
  badge,
  reduced,
  onDone,
}: {
  badge: Badge;
  reduced: boolean;
  onDone: (id: string) => void;
}) {
  const { convert, currency } = useCurrency();
  const display = convert(badge.amount);
  const counted = useCountUp(display, true, 600, reduced);
  const big = badge.tier === "big";
  const hasMultiplier = typeof badge.multiplier === "number" && badge.multiplier > 0;
  const life = big ? 3500 : 2500;

  useEffect(() => {
    const t = setTimeout(() => onDone(badge.id), life);
    return () => clearTimeout(t);
  }, [badge.id, life, onDone]);

  const amountLabel = `${currency.symbol} ${counted.toLocaleString(currency.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <div
      className={`aviator-win-badge pointer-events-none absolute left-1/2 z-20 flex -translate-x-1/2 flex-col items-center ${
        big ? "top-[14%]" : "top-[18%]"
      } ${reduced ? "" : "aviator-win-badge-anim"}`}
      role="status"
    >
      {big && !reduced && <ConfettiBurst active />}
      <div
        className={`relative flex flex-col items-center rounded-2xl px-5 py-3 text-center shadow-[0_0_40px_rgba(49,196,93,0.35)] ring-1 ${
          big
            ? "bg-gradient-to-b from-[#3a2a00] to-[#1a1400] ring-[#f5b942]/50 shadow-[0_0_48px_rgba(245,185,66,0.45)]"
            : "bg-gradient-to-b from-[#0f2a18] to-[#0a1610] ring-[#31c45d]/40"
        }`}
      >
        {big && (
          <p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#f5b942]">
            Big Win
          </p>
        )}
        <p className={`text-[11px] font-bold ${big ? "text-[#f5b942]/80" : "text-[#31c45d]/80"}`}>
          {badge.label ?? "You won!"}
        </p>
        {hasMultiplier ? (
          <>
            <p
              className={`mt-0.5 font-black tabular-nums leading-none ${
                big ? "text-[42px] text-[#f5b942] sm:text-[48px]" : "text-[34px] text-[#31c45d] sm:text-[40px]"
              }`}
            >
              {badge.multiplier!.toFixed(2)}×
            </p>
            <p className="mt-1.5 text-[15px] font-black tabular-nums text-white">{amountLabel}</p>
          </>
        ) : (
          // No multiplier (e.g. forex P/L) — the amount itself is the hero number.
          <p
            className={`mt-0.5 font-black tabular-nums leading-none text-white ${
              big ? "text-[36px] sm:text-[42px]" : "text-[30px] sm:text-[34px]"
            }`}
          >
            {amountLabel}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Imperative win celebration overlay for Aviator (and reusable later for binary).
 * Call `ref.current.fire({ multiplier, amount })` only after server confirmation.
 */
export const WinCelebration = forwardRef<WinCelebrationHandle, { soundEnabled: boolean }>(
  function WinCelebration({ soundEnabled }, ref) {
    const [badges, setBadges] = useState<Badge[]>([]);
    const [liveMsg, setLiveMsg] = useState("");
    const [reduced, setReduced] = useState(false);
    const soundEnabledRef = useRef(soundEnabled);
    const winAudioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
      soundEnabledRef.current = soundEnabled;
    }, [soundEnabled]);

    useEffect(() => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduced(mq.matches);
      const onChange = () => setReduced(mq.matches);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }, []);

    useEffect(() => {
      const audio = new Audio("/aviator/win.mp3");
      audio.volume = 0.45;
      audio.preload = "auto";
      winAudioRef.current = audio;
      // Content may be WAV bytes served as .mp3; fall back to explicit .wav.
      audio.addEventListener("error", () => {
        const wav = new Audio("/aviator/win.wav");
        wav.volume = 0.45;
        wav.preload = "auto";
        winAudioRef.current = wav;
      }, { once: true });
      return () => {
        winAudioRef.current?.pause();
        winAudioRef.current = null;
      };
    }, []);

    const remove = useCallback((id: string) => {
      setBadges((prev) => prev.filter((b) => b.id !== id));
    }, []);

    const fire = useCallback((payload: WinCelebrationPayload) => {
      const tier = resolveTier(payload);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setBadges((prev) => [...prev, { ...payload, id, tier }]);
      setLiveMsg(
        payload.multiplier
          ? `Cashed out at ${payload.multiplier.toFixed(2)} times for ${payload.amount.toFixed(2)}`
          : `You won ${payload.amount.toFixed(2)}`,
      );

      if (soundEnabledRef.current && !prefersReducedMotion()) {
        const a = winAudioRef.current;
        if (a) {
          a.currentTime = 0;
          void a.play().catch(() => undefined);
        }
      }
      if (!prefersReducedMotion()) {
        try {
          navigator.vibrate?.(35);
        } catch { /* unsupported */ }
      }
    }, []);

    useImperativeHandle(ref, () => ({ fire }), [fire]);

    // Stack offsets so rapid cashouts don't overwrite
    return (
      <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
        <div className="sr-only" aria-live="polite">
          {liveMsg}
        </div>
        {badges.map((b, i) => (
          <div
            key={b.id}
            style={{ transform: `translateY(${i * 72}px)` }}
            className="absolute inset-x-0 top-0"
          >
            <WinBadge badge={b} reduced={reduced} onDone={remove} />
          </div>
        ))}
      </div>
    );
  },
);

/** Count-up display for wallet/header balance after a win. */
export function RollingBalance({
  value,
  className,
  format,
}: {
  value: number;
  className?: string;
  format: (n: number) => string;
}) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    if (reduced || value <= from) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const delta = value - from;
    const ms = 600;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      setDisplay(from + delta * e);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);

  return <span className={className}>{format(display)}</span>;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Win toast — same top pill as "Even placed" / Aviator cashout. No center badge
 * behind it (that stacked duplicate looked like a second popup).
 *
 *   celebrateWin({ amount: winKes, toastTitle: "Even won!", toastDescription: "…" });
 *
 * Sound + haptic come from toast.cashout. WinCelebration (in-canvas badge) is
 * available for games that want a local overlay; do not also call celebrateWin
 * if you fire that overlay yourself.
 * ────────────────────────────────────────────────────────────────────────── */

/** Fire top toast + win sound. `amount` is canonical KES. */
export function celebrateWin(payload: WinCelebrationPayload) {
  if (!(payload.amount > 0)) return; // never celebrate a zero/negative outcome
  toast.cashout(
    payload.toastTitle ?? payload.label ?? "You won!",
    payload.toastDescription,
  );
}
