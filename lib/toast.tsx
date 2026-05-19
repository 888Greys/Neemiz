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

type ToastType = "success" | "error" | "info";

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

  const icon =
    item.type === "success" ? "check_circle"
    : item.type === "error" ? "error"
    : "info";

  const iconColor =
    item.type === "success" ? "text-emerald-400"
    : item.type === "error" ? "text-red-400"
    : "text-[#087cff]";

  const ringColor =
    item.type === "success" ? "ring-emerald-500/20"
    : item.type === "error" ? "ring-red-500/20"
    : "ring-[#087cff]/20";

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl bg-[#17181e] px-4 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ${ringColor} transition-all duration-300 ${
        visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
      }`}
      style={{ minWidth: 260, maxWidth: 340 }}
    >
      {/* Icon */}
      <span className={`material-symbols-outlined icon-fill text-[22px] mt-0.5 shrink-0 ${iconColor}`}>
        {icon}
      </span>

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
        <span className="material-symbols-outlined text-[15px]">close</span>
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
