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

/* ── Global queue — modules call toast.success() outside React ── */
type Listener = (t: ToastItem) => void;
const listeners: Set<Listener> = new Set();

function fire(type: ToastType, title: string, description?: string) {
  const id = Math.random().toString(36).slice(2, 9);
  const item: ToastItem = { id, type, title, description };
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

  const accentColor =
    item.type === "success" ? "bg-emerald-400"
    : item.type === "cashout" ? "bg-amber-400"
    : item.type === "error" ? "bg-red-400"
    : "bg-[#2a90ff]";

  return (
    <div
      className={`relative flex items-start gap-3 overflow-hidden rounded-2xl bg-[#111319]/95 px-4 py-4 shadow-[0_18px_55px_rgba(0,0,0,0.65)] ring-1 backdrop-blur-xl ${ringColor} transition-[transform,opacity] duration-500 ease-out ${
        visible ? "translate-x-0 scale-100 opacity-100" : "translate-x-10 scale-[0.96] opacity-0"
      }`}
      style={{ minWidth: 300, maxWidth: 380 }}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${accentColor}`} />
      {/* Icon */}
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] ${iconColor}`}>
        <IconComponent size={21} strokeWidth={2.5} />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black leading-snug text-white">{item.title}</p>
        {item.description && (
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300">{item.description}</p>
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
      <div
        className={`absolute bottom-0 left-0 h-0.5 ${accentColor} transition-[width] ease-linear`}
        style={{ width: visible ? "0%" : "100%", transitionDuration: visible ? "3800ms" : "0ms" }}
      />
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
      className="pointer-events-none fixed right-3 top-3 z-[9999] flex flex-col items-end gap-3 sm:right-5 sm:top-5"
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
