"use client";

/**
 * Lightweight zero-dependency toast system.
 * Usage anywhere in the app:
 *   import { toast } from "@/lib/toast";
 *   toast.success("Logged in!");
 *   toast.error("Something went wrong");
 *   toast.info("Balance updated");
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "cashout";

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

/* ── Audio feedback ── */
function playToastSound(type: ToastType) {
  if (typeof window === "undefined") return;
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.18, ctx.currentTime);
    master.connect(ctx.destination);

    const tone = (freq: number, start: number, duration: number, endFreq?: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(master);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      if (endFreq) osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + start + duration);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + start + 0.01);
      gain.gain.setValueAtTime(1, ctx.currentTime + start + duration - 0.04);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    }

    if (type === "cashout") {
      // Ascending win fanfare: C5 E5 G5 C6
      tone(523, 0,    0.12);
      tone(659, 0.1,  0.12);
      tone(784, 0.2,  0.12);
      tone(1047, 0.3, 0.22);
    } else if (type === "success") {
      // Two-note positive chime
      tone(660, 0,   0.12);
      tone(880, 0.13, 0.18);
    } else if (type === "error") {
      // Descending dull thud
      tone(330, 0,   0.14, 220);
      tone(220, 0.15, 0.18);
    } else {
      // Info: single soft beep
      tone(660, 0, 0.14);
    }

    setTimeout(() => ctx.close(), 1500);
  } catch {
    // AudioContext blocked (e.g. no user gesture yet) — silently ignore
  }
}

/* ── Global queue — modules call toast.success() outside React ── */
type Listener = (t: ToastItem) => void;
const listeners: Set<Listener> = new Set();

function fire(type: ToastType, title: string, description?: string) {
  const id = Math.random().toString(36).slice(2, 9);
  const item: ToastItem = { id, type, title, description };
  playToastSound(type);
  listeners.forEach((fn) => fn(item));
}

export const toast = {
  success: (title: string, description?: string) => fire("success", title, description),
  error:   (title: string, description?: string) => fire("error",   title, description),
  info:    (title: string, description?: string) => fire("info",    title, description),
  cashout: (title: string, description?: string) => fire("cashout", title, description),
};

/* ── Single toast card ── */
function Card({ item, onRemove }: { item: ToastItem; onRemove: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onRemove, 300);
    }, 3800);
    return () => clearTimeout(t);
  }, [onRemove]);

  const IconComponent =
    item.type === "success" ? CheckCircle
    : item.type === "cashout" ? CheckCircle
    : item.type === "error" ? AlertCircle
    : Info;

  const iconColor =
    item.type === "success" ? "text-emerald-400"
    : item.type === "cashout" ? "text-[#f59e0b]"
    : item.type === "error" ? "text-red-400"
    : "text-[#087cff]";

  const ringColor =
    item.type === "success" ? "ring-emerald-500/20"
    : item.type === "cashout" ? "ring-[#f59e0b]/40"
    : item.type === "error" ? "ring-red-500/20"
    : "ring-[#087cff]/20";

  const bgColor = item.type === "cashout" ? "bg-[#1c1500]" : "bg-[#17181e]";

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl ${bgColor} px-4 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ${ringColor} transition-all duration-300 ${
        visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
      }`}
      style={{ minWidth: 260, maxWidth: 340 }}
    >
      {/* Icon */}
      <IconComponent className={`shrink-0 mt-0.5 ${iconColor}`} size={20} strokeWidth={2.5} />

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-black text-white leading-snug">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 text-[11px] text-slate-400 leading-snug">{item.description}</p>
        )}
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={() => { setVisible(false); setTimeout(onRemove, 300); }}
        className="shrink-0 text-slate-600 hover:text-slate-300 transition mt-0.5"
      >
        <X size={15} strokeWidth={2} />
      </button>
    </div>
  );
}

/* ── Mount this once in layout.tsx ── */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    function add(item: ToastItem) {
      setItems((prev) => [...prev.slice(-4), item]); // cap at 5 visible
    }
    listeners.add(add);
    return () => { listeners.delete(add); };
  }, []);

  function remove(id: string) {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  if (!mounted) return null;

  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-4 right-4 z-[9999] flex flex-col items-end gap-2"
    >
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <Card item={item} onRemove={() => remove(item.id)} />
        </div>
      ))}
    </div>,
    document.body
  );
}
