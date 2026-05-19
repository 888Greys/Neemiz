"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { COUNTRIES, type Country } from "@/lib/countries";
import { Icon } from "@/components/icon";

type Props = {
  value: Country;
  onChange: (country: Country) => void;
};

export function CountryPicker({ value, onChange }: Props) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 260 });

  // Ensure we're in the browser before using createPortal
  useEffect(() => { setMounted(true); }, []);

  function openDropdown() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top:   rect.bottom + 4,          // fixed coords — no scrollY needed
        left:  rect.left,
        width: Math.max(260, rect.width),
      });
    }
    setSearch("");
    setOpen(true);
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler() { setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = COUNTRIES.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.includes(q) ||
      c.iso.toLowerCase().includes(q)
    );
  });

  return (
    <>
      {/* Trigger button — renders inline inside parent */}
      <button
        ref={btnRef}
        type="button"
        onClick={openDropdown}
        className="flex shrink-0 items-center gap-1.5 border-r border-white/10 px-3 py-3.5 text-sm transition hover:bg-white/[0.04]"
      >
        <span className="text-base leading-none">{value.flag}</span>
        <span className="text-slate-400 tabular-nums">{value.code}</span>
        <Icon name="expand_more" className={`text-[13px] text-slate-500 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown — portaled to body to escape any overflow:hidden ancestor */}
      {mounted && open && createPortal(
        <div
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#15161b] shadow-[0_8px_40px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-top-2 duration-150"
          onMouseDown={(e) => e.stopPropagation()}   // prevent outside-click handler from firing immediately
        >
          {/* Search bar */}
          <div className="border-b border-white/[0.07] p-2">
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.07] px-3 py-2">
              <Icon name="search" className="text-[15px] shrink-0 text-slate-500" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country…"
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 outline-none"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="text-slate-500 hover:text-white transition">
                  <Icon name="close" className="text-[13px]" />
                </button>
              )}
            </div>
          </div>

          {/* Country list */}
          <div className="no-scrollbar max-h-[220px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-4 text-center text-sm text-slate-500">No results for &quot;{search}&quot;</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.iso}
                  type="button"
                  onClick={() => { onChange(c); setOpen(false); }}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-white/[0.06] ${
                    c.iso === value.iso ? "bg-[#087cff]/10" : ""
                  }`}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className={`flex-1 text-left ${c.iso === value.iso ? "font-bold text-white" : "text-slate-300"}`}>
                    {c.name}
                  </span>
                  <span className="tabular-nums text-slate-500">{c.code}</span>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
