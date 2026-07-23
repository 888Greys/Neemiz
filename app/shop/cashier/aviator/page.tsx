"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { Icon } from "@/components/icon";
import { ThermalTicket, type TicketData } from "@/components/shop/thermal-ticket";
import { toast } from "@/lib/toast";

export default function CashierAviatorPage() {
  const [stake, setStake] = useState<string>("100");
  const [autoCashout, setAutoCashout] = useState<string>("2.00");
  const [ticketCodeInput, setTicketCodeInput] = useState<string>("");

  const [activeTicket, setActiveTicket] = useState<TicketData | null>(null);
  const [verifiedTicket, setVerifiedTicket] = useState<any>(null);
  const [isPending, startTransition] = useTransition();

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus barcode search field on load
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  async function handlePlaceTicket(e: React.FormEvent) {
    e.preventDefault();
    const stakeNum = Number(stake);
    if (!stakeNum || stakeNum < 10) {
      toast.error("Enter a valid stake (min KSh 10)");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/shop/aviator/ticket/place", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stake: stakeNum,
            autoCashout: autoCashout ? Number(autoCashout) : null,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Failed to place ticket");
          return;
        }

        toast.success(`Ticket ${data.ticket.ticketCode} created!`);
        setActiveTicket(data.ticket);

        // Trigger print after state update
        setTimeout(() => {
          window.print();
        }, 300);
      } catch (err) {
        toast.error("Network error while placing ticket");
      }
    });
  }

  async function handleVerifyTicket(e: React.FormEvent) {
    e.preventDefault();
    const code = ticketCodeInput.trim();
    if (!code) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/shop/aviator/ticket/verify?code=${encodeURIComponent(code)}`);
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Ticket not found");
          setVerifiedTicket(null);
          return;
        }

        setVerifiedTicket(data.ticket);
        toast.info(`Ticket ${data.ticket.ticketCode} status: ${data.ticket.status}`);
      } catch {
        toast.error("Error verifying ticket");
      }
    });
  }

  async function handlePayCash() {
    if (!verifiedTicket || !verifiedTicket.isPayable) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/shop/aviator/ticket/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketCode: verifiedTicket.ticketCode }),
        });

        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Payout failed");
          return;
        }

        toast.success(data.message);
        setVerifiedTicket((prev: any) =>
          prev ? { ...prev, status: "PAID", isPayable: false, paidAt: new Date().toISOString() } : null,
        );
      } catch {
        toast.error("Network error during payout");
      }
    });
  }

  return (
    <main className="min-h-screen bg-[#0e1015] text-slate-100 p-4 sm:p-6 font-sans">
      {/* Header Bar */}
      <header className="max-w-6xl mx-auto mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#161922] p-4 rounded-xl border border-white/10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-red-600 flex items-center justify-center font-black text-xl">
            POS
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">CASHIER AVIATOR TERMINAL</h1>
            <p className="text-xs text-slate-400">Retail Ticket Issuance & Payout Desk</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs sm:text-sm">
          <div className="bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-emerald-400 font-bold">
            Cash Drawer Float: KSh 500,000
          </div>
          <a
            href="/aviator/tv"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition"
          >
            <Icon name="tv" className="text-base" />
            <span>Open Shop TV Display</span>
          </a>
        </div>
      </header>

      {/* Main POS Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Ticket Issuance Form */}
        <section className="lg:col-span-7 bg-[#161922] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Icon name="confirmation_number" className="text-red-500 text-xl" />
              <span>Issue New Ticket</span>
            </h2>

            <form onSubmit={handlePlaceTicket} className="space-y-5">
              {/* Stake Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                  Stake Amount (KES)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    KSh
                  </span>
                  <input
                    type="number"
                    min="10"
                    step="10"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    className="w-full pl-14 pr-4 py-3 bg-[#0d0f14] border border-white/15 rounded-xl font-bold text-lg text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                {/* Quick Chips */}
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {["50", "100", "200", "500", "1000"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setStake(preset)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition border ${
                        stake === preset
                          ? "bg-red-600 border-red-500 text-white"
                          : "bg-[#0d0f14] border-white/10 text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto Cashout Multiplier */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                  Target Auto-Cashout Multiplier (x)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="1.01"
                  placeholder="e.g. 2.00"
                  value={autoCashout}
                  onChange={(e) => setAutoCashout(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0d0f14] border border-white/15 rounded-xl font-bold text-lg text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black text-lg rounded-xl shadow-lg transition flex items-center justify-center gap-2 uppercase tracking-wider"
              >
                <Icon name="print" className="text-2xl" />
                <span>{isPending ? "Processing..." : "Place & Print Ticket"}</span>
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 text-xs text-slate-400 flex items-center justify-between">
            <span>Press Numpad Enter to submit</span>
            <span>Thermal Receipt auto-triggers</span>
          </div>
        </section>

        {/* Right Column: Ticket Verification & Payout Desk */}
        <section className="lg:col-span-5 bg-[#161922] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Icon name="qr_code_scanner" className="text-emerald-400 text-xl" />
              <span>Verify & Pay Winner</span>
            </h2>

            <form onSubmit={handleVerifyTicket} className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                  Scan Barcode or Type Code
                </label>
                <div className="flex gap-2">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="e.g. AV-7X9K2M"
                    value={ticketCodeInput}
                    onChange={(e) => setTicketCodeInput(e.target.value)}
                    className="flex-1 px-4 py-3 bg-[#0d0f14] border border-white/15 rounded-xl font-mono font-bold text-base text-white uppercase focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center gap-1"
                  >
                    <Icon name="search" className="text-lg" />
                    <span>Scan</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Verified Ticket Card */}
            {verifiedTicket && (
              <div className="bg-[#0d0f14] border border-white/15 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="font-mono font-bold text-sm tracking-wider text-slate-200">
                    {verifiedTicket.ticketCode}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                      verifiedTicket.status === "WON"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : verifiedTicket.status === "PAID"
                        ? "bg-slate-700 text-slate-300"
                        : verifiedTicket.status === "LOST"
                        ? "bg-red-500/20 text-red-400 border border-red-500/40"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {verifiedTicket.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block">Stake:</span>
                    <span className="font-bold text-white">KSh {verifiedTicket.stake.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Round #:</span>
                    <span className="font-bold text-white">#{verifiedTicket.roundNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Crash Point:</span>
                    <span className="font-bold text-white">
                      {verifiedTicket.roundCrashPoint ? `${verifiedTicket.roundCrashPoint.toFixed(2)}x` : "Flying"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Payout:</span>
                    <span className="font-extrabold text-emerald-400 text-sm">
                      KSh {verifiedTicket.payout.toLocaleString()}
                    </span>
                  </div>
                </div>

                {verifiedTicket.isPayable && (
                  <button
                    type="button"
                    onClick={handlePayCash}
                    disabled={isPending}
                    className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-lg transition uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <Icon name="payments" className="text-xl" />
                    <span>PAY CASH NOW (KSh {verifiedTicket.payout.toLocaleString()})</span>
                  </button>
                )}

                {verifiedTicket.status === "PAID" && (
                  <div className="text-center text-xs text-slate-400 pt-1">
                    Paid at {new Date(verifiedTicket.paidAt).toLocaleTimeString()} by @
                    {verifiedTicket.paidByCashier}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Hidden printable receipt */}
      {activeTicket && <ThermalTicket ticket={activeTicket} />}
    </main>
  );
}
