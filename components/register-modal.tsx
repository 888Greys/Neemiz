"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { LoadingDots } from "@/components/loading-dots";
import { CountryPicker } from "@/components/country-picker";
import { COUNTRIES, type Country } from "@/lib/countries";
import { toast } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";


type Props = {
  onClose: () => void;
  onSwitchToLogin?: () => void;
};

export function RegisterModal({ onClose, onSwitchToLogin }: Props) {
  const [tab, setTab]                 = useState<"phone" | "email">("email");
  const [country, setCountry]         = useState<Country>(COUNTRIES[0]);
  const [phone, setPhone]             = useState("");
  const [email, setEmail]             = useState("");
  const [username, setUsername]       = useState("");
  const [password, setPassword]       = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [agreed, setAgreed]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [pendingVerify, setPendingVerify] = useState(false);
  const [code, setCode]               = useState("");
  const [resending, setResending]     = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) return;

    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (username && username.length < 4) { setError("Username must be at least 4 characters"); return; }

    if (!phone) { setError("Phone number is required"); return; }
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
    setError("");

    const supabase = createClient();

    try {
      if (tab === "email") {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username || null,
              first_name: null,
              phone_number: normalized,
            },
            // OTP-style confirmation (set "Email OTP" in Supabase Auth settings)
          },
        });

        if (authError) {
          setError(authError.message);
          return;
        }

        // Show OTP screen — Supabase sends a 6-digit code to the email
        setPendingVerify(true);
        startResendCooldown();
      } else {
        // Phone tab: register with phone number as email alias + password
        // Full phone auth (SMS OTP) requires Supabase SMS provider (Twilio/Vonage)
        const phoneEmail = normalized + "@phone.nezeem.com";

        const { error: authError } = await supabase.auth.signUp({
          email: phoneEmail,
          password,
          options: {
            data: {
              username: username || null,
              phone_number: normalized,
            },
          },
        });

        if (authError) {
          setError(authError.message);
          return;
        }

        // Phone registrations are auto-confirmed (no email OTP for phone-alias accounts)
        onClose();
        toast.success("Account created!", "Welcome to Nezeem 🎉");
        router.push("/dashboard");
      }
    } catch {
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e?: React.FormEvent, overrideCode?: string) {
    e?.preventDefault();
    const token = overrideCode ?? code;
    if (token.length < 6 || loading) return;
    setLoading(true);
    setError("");

    const supabase = createClient();

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "signup",
      });

      if (verifyError) {
        setCode("");
        setError(
          verifyError.message === "Token has expired or is invalid"
            ? "Code expired or invalid — request a new one below."
            : verifyError.message
        );
        return;
      }

      onClose();
      toast.success("Account verified!", "Welcome to Nezeem 🎉");
      router.push("/dashboard");
    } catch {
      setCode("");
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function startResendCooldown() {
    setResendCooldown(30);
    const t = setInterval(() => {
      setResendCooldown((v) => {
        if (v <= 1) { clearInterval(t); return 0; }
        return v - 1;
      });
    }, 1000);
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setResending(true);
    setError("");

    const supabase = createClient();

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (resendError) {
        setError(resendError.message);
        return;
      }

      startResendCooldown();
      toast.info("Code resent", "Check your inbox (and spam folder).");
    } catch {
      setError("Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
    // On success the browser redirects — no need to set loading false
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="relative w-full rounded-t-3xl border border-white/[0.08] bg-[#111316] shadow-2xl sm:max-w-[420px] sm:rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/10 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 sm:px-7 sm:pt-7 sm:pb-5">
          <h2 className="text-2xl font-black text-white">
            {pendingVerify ? "Verify account" : "Create account"}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-slate-400 transition hover:bg-white/10 hover:text-white"
            type="button"
            aria-label="Close"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 pb-8 sm:px-7 sm:pb-7" style={{ maxHeight: "90dvh" }}>
          <div key={pendingVerify ? "verify" : "register"} className="animate-fade-up" style={{ animationDuration: "0.25s" }}>
          {pendingVerify ? (
            /* ── Verification step ── */
            <form onSubmit={handleVerify} className="space-y-4">
              {/* Sent-to info */}
              <div className="rounded-2xl bg-[#18191f] px-4 py-3.5 ring-1 ring-white/[0.07]">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Code sent to</p>
                <p className="mt-0.5 font-bold text-white truncate">{email}</p>
              </div>


              {/* OTP input */}
              <div className="flex items-center gap-3 overflow-hidden rounded-2xl bg-[#18191f] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
                <Icon name="verified" fill className="text-[18px] shrink-0 text-slate-500" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setCode(v);
                    if (v.length === 6) handleVerify(undefined, v);
                  }}
                  placeholder="Enter 6-digit code"
                  className="flex-1 bg-transparent py-3.5 text-lg font-black text-white placeholder-slate-600 outline-none tracking-[0.3em]"
                  maxLength={6}
                  autoFocus
                />
                {loading && (
                  <svg className="h-4 w-4 shrink-0 animate-spin text-[#087cff]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
              </div>

              {error && (
                <div className="rounded-xl bg-red-500/10 px-4 py-3 ring-1 ring-red-500/20">
                  <p className="text-xs font-bold text-red-400">{error}</p>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || resending}
                    className="mt-1.5 text-xs font-black text-[#087cff] transition hover:text-blue-400 disabled:cursor-not-allowed disabled:text-slate-600"
                  >
                    {resending ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "→ Send a new code"}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full rounded-2xl bg-[#05b957] py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-[#07cc63] active:scale-[.98] disabled:opacity-60"
              >
                Verify & Enter
              </button>

              {/* Resend — shown when no error */}
              {!error && (
                <p className="text-center text-xs text-slate-500">
                  Still nothing?{" "}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || resending}
                    className="font-black text-[#087cff] transition hover:text-blue-400 disabled:cursor-not-allowed disabled:text-slate-600"
                  >
                    {resending ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                </p>
              )}
            </form>
          ) : (
            <>
              {/* Tab switcher */}
              <div className="mb-5 grid grid-cols-2 gap-1.5 rounded-2xl bg-[#18191f] p-1">
                {(["email", "phone"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    type="button"
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black transition ${
                      tab === t ? "bg-[#087cff] text-white shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <Icon name={t === "phone" ? "phone" : "mail"} fill className="text-[15px]" />
                    {t === "phone" ? "Phone" : "Email"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Email and Phone for Email tab, just Phone for Phone tab */}
                {tab === "email" ? (
                  <>
                    <div className="flex items-center gap-3 overflow-hidden rounded-2xl bg-[#18191f] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
                      <Icon name="mail" fill className="text-[18px] shrink-0 text-slate-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder-slate-600 outline-none"
                      />
                    </div>

                    <div className="flex rounded-2xl bg-[#18191f] ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
                      <CountryPicker value={country} onChange={setCountry} />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="700 000000 (M-Pesa number)"
                        required
                        className="flex-1 bg-transparent px-4 py-3.5 text-sm text-white placeholder-slate-600 outline-none"
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex rounded-2xl bg-[#18191f] ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
                    <CountryPicker value={country} onChange={setCountry} />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="700 000000"
                      required
                      className="flex-1 bg-transparent px-4 py-3.5 text-sm text-white placeholder-slate-600 outline-none"
                    />
                  </div>
                )}

                {/* Username */}
                <div className="flex items-center gap-3 overflow-hidden rounded-2xl bg-[#18191f] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
                  <Icon name="person" fill className="text-[18px] shrink-0 text-slate-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username (optional)"
                    className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder-slate-600 outline-none"
                  />
                </div>

                {/* Password */}
                <div className="flex items-center gap-3 overflow-hidden rounded-2xl bg-[#18191f] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
                  <Icon name="lock" fill className="text-[18px] shrink-0 text-slate-500" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create password"
                    required
                    minLength={8}
                    className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder-slate-600 outline-none"
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)} className="text-slate-500 transition hover:text-slate-300">
                    <Icon name={showPw ? "visibility_off" : "visibility"} className="text-[18px]" />
                  </button>
                </div>

                {/* Confirm Password */}
                <div className={`flex items-center gap-3 overflow-hidden rounded-2xl bg-[#18191f] px-4 ring-1 focus-within:ring-[#087cff]/50 ${
                  confirmPassword && password !== confirmPassword ? "ring-red-500/50" : "ring-white/[0.07]"
                }`}>
                  <Icon name="lock" fill className={`text-[18px] shrink-0 ${confirmPassword && password !== confirmPassword ? "text-red-400" : "text-slate-500"}`} />
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    required
                    className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder-slate-600 outline-none"
                  />
                  <button type="button" onClick={() => setShowConfirmPw((v) => !v)} className="text-slate-500 transition hover:text-slate-300">
                    <Icon name={showConfirmPw ? "visibility_off" : "visibility"} className="text-[18px]" />
                  </button>
                </div>

                {error && <p className="rounded-xl bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400">{error}</p>}

                {/* Terms */}
                <label className="flex cursor-pointer items-start gap-3 pt-1">
                  <div
                    onClick={() => setAgreed((v) => !v)}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${agreed ? "border-[#087cff] bg-[#087cff]" : "border-white/20 bg-white/5"}`}
                  >
                    {agreed && <Icon name="check" className="text-[13px] text-white" />}
                  </div>
                  <span className="text-[11px] leading-4 text-slate-500">
                    I agree to the{" "}
                    <Link href="#" className="text-[#087cff] hover:underline">Terms of Service</Link>
                    {" "}and{" "}
                    <Link href="#" className="text-[#087cff] hover:underline">Privacy Policy</Link>.
                    I confirm I am 18+ years old.
                  </span>
                </label>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || !agreed}
                  className="w-full rounded-2xl bg-[#05b957] py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-[#07cc63] active:scale-[.98] disabled:opacity-50"
                >
                  {loading ? <LoadingDots label="Creating account" /> : "Create Account"}
                </button>
              </form>

              {/* Divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="flex-1 border-t border-white/[0.07]" />
                <span className="text-xs text-slate-600">or sign up with</span>
                <div className="flex-1 border-t border-white/[0.07]" />
              </div>

              {/* Social */}
              <div className="flex justify-center gap-2.5">
                <button type="button" onClick={() => handleOAuth("google")} aria-label="Sign up with Google"
                  className="flex h-11 items-center justify-center gap-2.5 rounded-xl bg-[#18191f] px-5 ring-1 ring-white/[0.07] transition hover:bg-[#22252e]"
                >
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="text-sm font-black text-white">Continue with Google</span>
                </button>
              </div>
            </>
          )}
          </div>

          {/* Switch to login */}
          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-black text-[#087cff] transition hover:text-blue-400"
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
