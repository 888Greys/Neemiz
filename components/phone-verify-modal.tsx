"use client";

import { useState, useEffect, FormEvent } from "react";
import { Icon } from "@/components/icon";

/**
 * SMS phone-verification modal used to gate the first withdrawal.
 *
 * Two steps: enter a Safaricom number → Twilio Verify texts a code
 * (/api/account/phone/send-otp) → enter the code (/api/account/phone/verify-otp).
 * On success the number is bound to the account for life (server-enforced) and
 * onVerified(phone) fires with the normalized 254… number so the caller can lock
 * the field and resume the withdrawal.
 */
type PhoneVerifyModalProps = {
  initialPhone?: string;        // prefill (e.g. an already-linked but unverified number)
  onVerified: (phone: string) => void;
  onClose: () => void;
};

// 07XX / 01XX / +254… → 254XXXXXXXXX
function normalizeKe(raw: string): string {
  let v = raw.trim().replace(/\s+/g, "").replace("+", "");
  if (v.startsWith("0")) v = "254" + v.slice(1);
  else if (v.length === 9) v = "254" + v;
  return v;
}

export function PhoneVerifyModal({ initialPhone, onVerified, onClose }: PhoneVerifyModalProps) {
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState(() => {
    if (!initialPhone) return "";
    return initialPhone.startsWith("254") ? `0${initialPhone.slice(3)}` : initialPhone;
  });
  const [sentPhone, setSentPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function sendCode(target: string) {
    const res = await fetch("/api/account/phone/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: target }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not send the code. Try again.");
    return (data.phone as string) ?? target;
  }

  async function handleSendPhone(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    const normalized = normalizeKe(phone);
    if (!/^254[17]\d{8}$/.test(normalized)) {
      setError("Enter a valid Safaricom number (07XX or 01XX).");
      return;
    }
    setLoading(true); setError("");
    try {
      const confirmed = await sendCode(normalized);
      setSentPhone(confirmed);
      setStage("code");
      setResendIn(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(value: string) {
    if (loading) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/account/phone/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: sentPhone, code: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCode("");
        setError(data.error || "Verification failed. Try again.");
        return;
      }
      onVerified((data.phone as string) ?? sentPhone);
    } catch {
      setCode("");
      setError("Verification failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0 || loading) return;
    setError("");
    try {
      await sendCode(sentPhone);
      setResendIn(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend.");
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-[420px] rounded-3xl border border-white/[0.08] bg-[#111316] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#087cff]/10 text-[#087cff]">
            <Icon name="sms" fill className="text-[32px]" />
          </div>
          <h2 className="text-2xl font-black text-white">Verify your number</h2>
          <p className="mt-2 text-sm text-slate-400">
            {stage === "phone"
              ? "Confirm your mobile number by SMS to withdraw. It will be locked to your account for security."
              : <>Enter the code we texted to <span className="font-bold text-white">+{sentPhone}</span>.</>}
          </p>
        </div>

        {stage === "phone" ? (
          <form onSubmit={handleSendPhone} className="mt-6 space-y-4">
            <div className="flex items-center gap-2 rounded-2xl bg-[#18191f] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
              <span className="text-sm font-black text-slate-500">+254</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="700 000000"
                required
                disabled={loading}
                autoFocus
                className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder-slate-600 outline-none disabled:opacity-50"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#087cff] py-3.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#1a85ff] active:scale-[.98] disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); if (code.length === 6) submitCode(code); }} className="mt-6 space-y-4">
            <div className="flex items-center gap-3 overflow-hidden rounded-2xl bg-[#18191f] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
              <Icon name="verified" fill className="text-[18px] shrink-0 text-slate-500" />
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                  if (v.length === 6) submitCode(v);
                }}
                placeholder="Enter 6-digit code"
                maxLength={6}
                autoFocus
                disabled={loading}
                className="flex-1 bg-transparent py-3.5 text-lg font-black text-white placeholder-slate-600 outline-none tracking-[0.3em]"
              />
              {loading && (
                <svg className="h-4 w-4 shrink-0 animate-spin text-[#087cff]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </div>

            {error && (
              <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-400">{error}</p>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setStage("phone"); setCode(""); setError(""); }}
                className="text-xs font-black text-slate-500 transition hover:text-slate-300"
              >
                ← Change number
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendIn > 0}
                className="text-xs font-black text-[#087cff] transition hover:text-blue-400 disabled:cursor-not-allowed disabled:text-slate-600"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="mt-4 w-full text-center text-xs font-bold text-slate-500 transition hover:text-slate-300 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
