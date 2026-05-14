"use client";

import { useState } from "react";
import Link from "next/link";
import { useSignUp } from "@clerk/nextjs";
import { Icon } from "@/components/icon";

function TgIcon() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none">
      <path d="M20.7 4.1 3.9 10.6c-1.1.4-1.1 1.1-.2 1.4l4.3 1.3 1.7 5.2c.2.6.3.8.7.8.4 0 .6-.2.9-.5l2.1-2 4.4 3.2c.8.4 1.3.2 1.5-.8l2.7-12.8c.3-1.2-.5-1.7-1.3-1.3Z" fill="currentColor" />
      <path d="m8.7 13 8.8-5.6c.4-.3.8-.1.5.2l-7.1 6.5-.3 3.1-1.9-4.2Z" fill="#111316" opacity=".55" />
    </svg>
  );
}

const COUNTRIES = [
  { flag: "🇰🇪", code: "+254", iso: "KE" },
  { flag: "🇺🇸", code: "+1",   iso: "US" },
  { flag: "🇬🇧", code: "+44",  iso: "GB" },
  { flag: "🇳🇬", code: "+234", iso: "NG" },
  { flag: "🇿🇦", code: "+27",  iso: "ZA" },
  { flag: "🇹🇿", code: "+255", iso: "TZ" },
  { flag: "🇺🇬", code: "+256", iso: "UG" },
  { flag: "🇮🇳", code: "+91",  iso: "IN" },
  { flag: "🇦🇪", code: "+971", iso: "AE" },
];

type Props = {
  onClose: () => void;
  onSwitchToLogin?: () => void;
};

export function RegisterModal({ onClose, onSwitchToLogin }: Props) {
  const [tab, setTab]           = useState<"phone" | "email">("email");
  const [country, setCountry]   = useState(COUNTRIES[0]);
  const [showCC, setShowCC]     = useState(false);
  const [phone, setPhone]       = useState("");
  const [email, setEmail]       = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [agreed, setAgreed]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [pendingVerify, setPendingVerify] = useState(false);
  const [code, setCode]         = useState("");

  const { signUp, isLoaded, setActive } = useSignUp();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !agreed) return;
    setLoading(true);
    setError("");
    try {
      if (tab === "email") {
        await signUp.create({ emailAddress: email, password, username: username || undefined });
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setPendingVerify(true);
      } else {
        await signUp.create({ phoneNumber: `${country.code}${phone}`, password, username: username || undefined });
        await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
        setPendingVerify(true);
      }
    } catch (err: unknown) {
      const e = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError("");
    try {
      const result = tab === "email"
        ? await signUp.attemptEmailAddressVerification({ code })
        : await signUp.attemptPhoneNumberVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        onClose();
      }
    } catch (err: unknown) {
      const e = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(strategy: "oauth_google" | "oauth_github") {
    if (!isLoaded) return;
    await signUp.authenticateWithRedirect({
      strategy,
      redirectUrl: "/sso-callback",
      redirectUrlComplete: "/dashboard",
    });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-[420px] rounded-3xl border border-white/[0.08] bg-[#111316] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-7 pb-5">
          <h2 className="text-2xl font-black text-white">Registration</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-slate-400 transition hover:bg-white/10 hover:text-white"
            type="button"
            aria-label="Close"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <div className="px-7 pb-7">
          {pendingVerify ? (
            /* ── Verification step ── */
            <form onSubmit={handleVerify} className="space-y-4">
              <p className="text-sm text-slate-400">
                Enter the verification code sent to your {tab === "email" ? "email" : "phone"}.
              </p>
              <div className="flex items-center gap-3 overflow-hidden rounded-2xl bg-[#18191f] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
                <Icon name="verified" fill className="text-[18px] shrink-0 text-slate-500" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter code"
                  className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder-slate-600 outline-none tracking-[0.2em]"
                  maxLength={6}
                  autoFocus
                />
              </div>
              {error && <p className="rounded-xl bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#05b957] py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-[#07cc63] active:scale-[.98] disabled:opacity-60"
              >
                {loading ? "Verifying…" : "Verify & Create Account"}
              </button>
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
                {/* Email or Phone */}
                {tab === "email" ? (
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
                ) : (
                  <div className="relative flex overflow-hidden rounded-2xl bg-[#18191f] ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
                    <button
                      type="button"
                      onClick={() => setShowCC((v) => !v)}
                      className="flex shrink-0 items-center gap-1 border-r border-white/10 px-3 py-3.5 text-sm transition hover:bg-white/[0.04]"
                    >
                      <span className="text-base leading-none">{country.flag}</span>
                      <span className="text-slate-400">{country.code}</span>
                      <Icon name="expand_more" className="text-[14px] text-slate-500" />
                    </button>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="700 000000"
                      required
                      className="flex-1 bg-transparent px-4 py-3.5 text-sm text-white placeholder-slate-600 outline-none"
                    />
                    {showCC && (
                      <div className="absolute left-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#18191f] shadow-xl">
                        {COUNTRIES.map((c) => (
                          <button
                            key={c.iso}
                            type="button"
                            onClick={() => { setCountry(c); setShowCC(false); }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.06]"
                          >
                            <span>{c.flag}</span>
                            <span className="flex-1 text-left">{c.iso}</span>
                            <span className="text-slate-500">{c.code}</span>
                          </button>
                        ))}
                      </div>
                    )}
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
                    className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder-slate-600 outline-none"
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)} className="text-slate-500 transition hover:text-slate-300">
                    <Icon name={showPw ? "visibility_off" : "visibility"} className="text-[18px]" />
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
                  {loading ? "Creating account…" : "Create Account"}
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
                <button type="button" onClick={() => handleOAuth("oauth_google")} aria-label="Google"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#18191f] ring-1 ring-white/[0.07] transition hover:bg-[#22252e]"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </button>
                <button type="button" aria-label="Telegram"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#18191f] text-[#2AABEE] ring-1 ring-white/[0.07] transition hover:bg-[#22252e]"
                >
                  <TgIcon />
                </button>
                <button type="button" onClick={() => handleOAuth("oauth_github")} aria-label="GitHub"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#18191f] text-white ring-1 ring-white/[0.07] transition hover:bg-[#22252e]"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.46-1.11-1.46-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 12 6.8c.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10z"/>
                  </svg>
                </button>
                <button type="button" aria-label="Apple"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#18191f] text-white ring-1 ring-white/[0.07] transition hover:bg-[#22252e]"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                </button>
              </div>
            </>
          )}

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
