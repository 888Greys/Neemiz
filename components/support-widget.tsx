"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

function TelegramIcon() {
  return (
    <svg className="h-[16px] w-[16px]" viewBox="0 0 24 24" fill="none">
      <path d="M20.7 4.1 3.9 10.6c-1.1.4-1.1 1.1-.2 1.4l4.3 1.3 1.7 5.2c.2.6.3.8.7.8.4 0 .6-.2.9-.5l2.1-2 4.4 3.2c.8.4 1.3.2 1.5-.8l2.7-12.8c.3-1.2-.5-1.7-1.3-1.3Z" fill="currentColor" />
      <path d="m8.7 13 8.8-5.6c.4-.3.8-.1.5.2l-7.1 6.5-.3 3.1-1.9-4.2Z" fill="#111316" opacity=".55" />
    </svg>
  );
}

export function SupportWidget() {
  const [open, setOpen]       = useState(false);
  const [name, setName]       = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent]       = useState(false);

  function handleSend() {
    if (!message.trim()) return;
    setSent(true);
  }

  return (
    <div className="fixed bottom-6 right-6 z-[150] hidden flex-col items-end gap-3 lg:flex">

      {/* ── Chat panel ── */}
      {open && (
        <div
          className="w-[320px] overflow-hidden rounded-3xl bg-[#111316] shadow-[0_8px_48px_rgba(0,0,0,0.7)] ring-1 ring-white/[0.09] animate-in fade-in slide-in-from-bottom-3 duration-250"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative flex items-center gap-3 bg-gradient-to-r from-[#0556c8] to-[#087cff] px-4 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
              <Icon name="support_agent" fill className="text-[22px] text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Welcome to Nezeem 👋</p>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <p className="text-[11px] text-blue-100">We are ready to help you 24/7</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <Icon name="close" className="text-[16px]" />
            </button>
          </div>

          <div className="p-4">
            {sent ? (
              /* ── Sent state ── */
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                  <Icon name="check_circle" fill className="text-[32px] text-emerald-400" />
                </div>
                <p className="font-black text-white">Message sent!</p>
                <p className="text-xs text-slate-500">Our support team will get back to you shortly.</p>
                <button
                  type="button"
                  onClick={() => { setSent(false); setMessage(""); setName(""); }}
                  className="mt-1 rounded-xl bg-white/[0.06] px-4 py-2 text-xs font-black text-slate-300 transition hover:bg-white/[0.10]"
                >
                  Send another
                </button>
              </div>
            ) : (
              /* ── Form ── */
              <div className="space-y-3">
                {/* Name */}
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="w-full rounded-xl bg-[#18191f] px-3.5 py-3 text-sm text-white outline-none ring-1 ring-white/[0.07] placeholder:text-slate-600 focus:ring-[#087cff]/50 transition"
                />
                {/* Message */}
                <div className="relative">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="How can we help you?"
                    rows={3}
                    className="w-full resize-none rounded-xl bg-[#18191f] px-3.5 py-3 text-sm text-white outline-none ring-1 ring-white/[0.07] placeholder:text-slate-600 focus:ring-[#087cff]/50 transition"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!message.trim()}
                  className="w-full rounded-xl bg-[#087cff] py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#2a90ff] active:scale-[0.98] disabled:opacity-40"
                >
                  Start chat
                </button>

                {/* Divider */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-white/[0.06]" />
                  <span className="text-[10px] text-slate-600">or reach us on</span>
                  <div className="flex-1 border-t border-white/[0.06]" />
                </div>

                {/* Social quick-contact */}
                <div className="flex justify-center gap-2">
                  <a
                    href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "254700000000"}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#25D366] ring-1 ring-[#25D366]/20 transition hover:bg-[#25D366]/25"
                  >
                    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2-.2-.3 0-.5.1-.6l.5-.6c.1-.2.1-.3.2-.5 0-.2 0-.4-.1-.5-.1-.1-.7-1.6-1-2.2-.2-.6-.5-.5-.7-.5H8c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.1 3c.1.2 2 3 4.8 4.2.7.3 1.2.4 1.6.5.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.6.2-1.2.1-1.3-.1-.1-.3-.2-.6-.3zm-5.4 7.3h-.1a10.4 10.4 0 0 1-5.3-1.5l-.4-.2-3.7 1 1-3.6-.3-.4a10.5 10.5 0 1 1 8.8 4.7zm0-20C5.4 1.7 1 6.2 1 11.7c0 1.9.5 3.7 1.4 5.2L1 22l5.2-1.4a10.3 10.3 0 0 0 5 1.3c5.5 0 10-4.5 10-10S17.7 1.7 12.1 1.7z" />
                    </svg>
                  </a>
                  <a
                    href="https://t.me/nezeemSupport"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2AABEE]/15 text-[#2AABEE] ring-1 ring-[#2AABEE]/20 transition hover:bg-[#2AABEE]/25"
                  >
                    <TelegramIcon />
                  </a>
                  <a
                    href="mailto:support@nezeem.com"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-slate-400 ring-1 ring-white/[0.08] transition hover:bg-white/[0.10] hover:text-white"
                  >
                    <Icon name="mail" fill className="text-[17px]" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FAB button ── */}
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (sent) { setSent(false); setMessage(""); setName(""); } }}
        className={`relative flex h-14 w-14 items-center justify-center rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.5)] transition-all duration-200 active:scale-[0.94] ${
          open
            ? "bg-[#18191f] ring-1 ring-white/[0.12] rotate-0"
            : "bg-[#087cff] shadow-blue-500/30 hover:bg-[#2a90ff]"
        }`}
        aria-label="Support"
      >
        <Icon
          name={open ? "close" : "mode_comment"}
          fill={!open}
          className={`text-[24px] text-white transition-transform duration-200 ${open ? "" : ""}`}
        />
        {!open && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-black text-white ring-2 ring-[#151518]">
            24/7
          </span>
        )}
      </button>
    </div>
  );
}
