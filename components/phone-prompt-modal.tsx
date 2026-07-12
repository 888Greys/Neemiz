"use client";

import { useState, FormEvent } from "react";
import { CountryPicker } from "@/components/country-picker";
import { COUNTRIES, type Country } from "@/lib/countries";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";

type PhonePromptModalProps = {
  onComplete: (phone: string) => void;
  /** Show a brief "Email verified ✓" confirmation before the phone form.
   *  Used for social (Google/GitHub) sign-ups, which arrive pre-verified. */
  verifiedIntro?: boolean;
};

export function PhonePromptModal({ onComplete, verifiedIntro = false }: PhonePromptModalProps) {
  // Social sign-ups see a "verified" confirmation first, then the phone form.
  const [step, setStep] = useState<"verified" | "phone">(verifiedIntro ? "verified" : "phone");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<Country>(() => {
    return COUNTRIES.find((c) => c.iso === "KE") || COUNTRIES[0];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");

    if (!phone) {
      setError("Please enter your phone number.");
      return;
    }

    const rawPhone = phone.trim().replace(/\s+/g, "").replace("+", "");
    let normalized = rawPhone;

    if (country.code === "+254") {
      if (normalized.startsWith("0")) {
        normalized = "254" + normalized.slice(1);
      } else if (!normalized.startsWith("254") && normalized.length === 9) {
        normalized = "254" + normalized;
      }
      if (!/^254[17]\d{8}$/.test(normalized)) {
        setError("Please enter a valid Safaricom number (e.g. 07XX or 01XX).");
        return;
      }
    } else {
      const cleanCode = country.code.replace("+", "");
      if (!normalized.startsWith(cleanCode)) {
        normalized = cleanCode + normalized;
      }
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const submit = () => fetch("/api/account/mpesa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      });

      let res = await submit();

      // 401 = the server didn't see a valid session (stale/expired cookie). Try
      // to refresh the session once and resubmit before giving up, so a simply
      // expired token doesn't dead-end the user with "Unauthorized".
      if (res.status === 401) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session) {
          res = await submit();
        }
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session has expired. Please sign in again to link your number.");
        } else {
          setError(data.error || "Failed to update phone number.");
        }
        return;
      }

      // Sync updated phone number to client session metadata so it displays in settings immediately
      await supabase.auth.updateUser({
        data: { phone_number: normalized }
      });

      toast.success("Phone number linked!", "Your account is now secure.");
      onComplete(normalized);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "verified") {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="w-full max-w-[420px] rounded-3xl border border-white/[0.08] bg-[#111316] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 animate-in zoom-in-50 duration-300">
              <Icon name="check_circle" fill className="text-[36px]" />
            </div>
            <h2 className="text-2xl font-black text-white">Email verified</h2>
            <p className="mt-2 text-sm text-slate-400">
              Your email is confirmed. One last step — add the mobile number you&apos;ll use for deposits and withdrawals.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep("phone")}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#087cff] py-3.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#1a85ff] active:scale-[.98]"
          >
            Continue
            <Icon name="arrow_forward" className="text-[18px]" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-[420px] rounded-3xl border border-white/[0.08] bg-[#111316] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#087cff]/10 text-[#087cff]">
            <Icon name="verified_user" fill className="text-[32px]" />
          </div>
          <h2 className="text-2xl font-black text-white">Link Mobile Number</h2>
          <p className="mt-2 text-sm text-slate-400">
            A valid Safaricom mobile number is required for all deposits and withdrawals.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="flex rounded-2xl bg-[#18191f] ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
            <CountryPicker value={country} onChange={setCountry} />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="700 000000"
              required
              disabled={loading}
              className="flex-1 bg-transparent px-4 py-3.5 text-sm text-white placeholder-slate-600 outline-none disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#087cff] py-3.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#1a85ff] active:scale-[.98] disabled:opacity-60"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 shrink-0 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : (
              "Verify & Link Number"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
