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
import { CheckCircle, AlertCircle, Info } from "lucide-react";
import { haptic, playSound } from "@/lib/game-feel";

type ToastType = "success" | "error" | "info" | "cashout" | "loss";

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

/* ── Global queue — modules call toast.success() outside React ── */
type Listener = (t: ToastItem) => void;
const listeners: Set<Listener> = new Set();

function fire(type: ToastType, title: string, description?: string, opts?: { silent?: boolean }) {
  const id = Math.random().toString(36).slice(2, 9);
  const item: ToastItem = { id, type, title, description };
  listeners.forEach((fn) => fn(item));
  // Central feedback hub: every game routes wins/losses through the toast, so
  // pairing sound + haptic here gives consistent game feel everywhere for free.
  // Operational errors get a soft warning buzz only (no melody).
  if (opts?.silent) return;
  if (type === "cashout") { playSound("win"); haptic("success"); }
  else if (type === "loss") { playSound("lose"); haptic("warning"); }
  else if (type === "error") { haptic("warning"); }
}

export const toast = {
  success: (title: string, description?: string) => fire("success", title, description),
  error:   (title: string, description?: string) => fire("error",   title, description),
  info:    (title: string, description?: string) => fire("info",    title, description),
  cashout: (title: string, description?: string, opts?: { silent?: boolean }) => fire("cashout", title, description, opts),
  /** Game loss — distinct from operational error: plays the soft "lose" cue. */
  loss:    (title: string, description?: string) => fire("loss",    title, description),
};

/* ── Single toast pill (Spribe-style: dark rounded pill that fades) ── */
function Card({ item, onRemove }: { item: ToastItem; onRemove: () => void }) {
  const [visible, setVisible] = useState(false);

  // Wins linger a bit longer so they read like the "RISE placed" place toast.
  const duration = item.type === "error" ? 5000 : item.type === "cashout" ? 4200 : 3200;

  function dismiss() {
    setVisible(false);
    setTimeout(onRemove, 260);
  }

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(dismiss, duration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const IconComponent =
    item.type === "success" ? CheckCircle
    : item.type === "cashout" ? CheckCircle
    : item.type === "error" || item.type === "loss" ? AlertCircle
    : Info;

  // Win/cashout = green, loss/error = red, info = blue.
  const tint =
    item.type === "success" ? { icon: "text-emerald-400", ring: "ring-emerald-500/25" }
    : item.type === "cashout" ? { icon: "text-emerald-400", ring: "ring-emerald-500/25" }
    : item.type === "error" || item.type === "loss" ? { icon: "text-red-400", ring: "ring-red-500/30" }
    :                           { icon: "text-[#3aa0ff]",   ring: "ring-[#3aa0ff]/20" };

  return (
    <button
      type="button"
      onClick={dismiss}
      aria-label="Dismiss notification"
      className={`pointer-events-auto flex items-center gap-2 rounded-full bg-[#1c1d22]/95 py-1.5 pl-2.5 pr-3.5 text-left shadow-[0_10px_30px_rgba(0,0,0,0.5)] ring-1 backdrop-blur-xl transition-[transform,opacity] duration-300 ease-out sm:gap-2.5 sm:py-2 sm:pl-3 sm:pr-4 ${tint.ring} ${
        visible ? "translate-y-0 scale-100 opacity-100" : "-translate-y-2 scale-[0.96] opacity-0"
      }`}
      style={{ maxWidth: "min(90vw, 360px)" }}
    >
      <IconComponent strokeWidth={2.6} className={`h-[14px] w-[14px] shrink-0 sm:h-[17px] sm:w-[17px] ${tint.icon}`} />
      <div className="min-w-0">
        <p className="truncate text-[11.5px] font-bold leading-tight text-white sm:text-[13px]">{item.title}</p>
        {item.description && (
          <p className="mt-px truncate text-[10px] font-medium leading-tight text-white/45 sm:text-[11px]">{item.description}</p>
        )}
      </div>
    </button>
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
      className="pointer-events-none fixed inset-x-0 top-3 z-[9999] flex flex-col items-center gap-2 px-3 sm:top-5"
    >
      {items.map((item) => (
        <Card key={item.id} item={item} onRemove={() => remove(item.id)} />
      ))}
    </div>,
    document.body
  );
}
