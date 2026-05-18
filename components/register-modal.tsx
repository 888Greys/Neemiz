"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignUp, useSignIn, useClerk } from "@clerk/nextjs";
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
  const [tab, setTab]                 = useState<"phone" | "email">("email");
  const [country, setCountry]         = useState(COUNTRIES[0]);
  const [showCC, setShowCC]           = useState(false);
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
  // pendingVerify only shown when Clerk requires OTP (instance setting); user can skip
  const [pendingVerify, setPendingVerify] = useState(false);
  const [code, setCode]               = useState("");

  const { signUp } = useSignUp();
  const { signIn } = useSignIn();
  const { setActive } = useClerk();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp || !agreed) return;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (username && username.length < 4) {
      setError("Username must be at least 4 characters");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const params = tab === "email"
        ? { emailAddress: email, password, ...(username ? { username } : {}) }
        : { phoneNumber: `${country.code}${phone}`, password, ...(username ? { username } : {}) };

      await Promise.race([
        signUp.create(params as Parameters<typeof signUp.create>[0]),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Request timed out. Please check your connection and try again.")), 15_000)),
      ]);

      if (signUp.status === "complete" && signUp.createdSessionId) {
        // Verification disabled in Clerk dashboard — instant login
        await setActive({ session: signUp.createdSessionId });
        onClose();
        router.push("/dashboard");
      } else {
        // Clerk requires OTP — try to trigger the send, but don't block on it
        // (if prepareEmailAddressVerification hangs we still show the verify screen)
        try {
          const su = signUp as any;
          await Promise.race([
            tab === "email"
              ? su.prepareEmailAddressVerification({ strategy: "email_code" })
              : su.preparePhoneNumberVerification(),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8_000)),
          ]);
        } catch {
          // If preparation fails or times out the code may still arrive;
          // show the verify screen anyway so the user can enter it.
        }
        setPendingVerify(true);
      }
    } catch (err: unknown) {
      const e = err as { errors?: { longMessage?: string; message?: string }[] };
      const msg = e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "";
      setError(msg || "Registration failed. Please try again or log in if you already have an account.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setLoading(true);
    setError("");
    try {
      const su = signUp as any;
      if (tab === "email") {
        await su.attemptEmailAddressVerification({ code });
      } else {
        await su.attemptPhoneNumberVerification({ code });
      }

      if (signUp.status === "complete" && signUp.createdSessionId) {
        await setActive({ session: signUp.createdSessionId });
        onClose();
        router.push("/dashboard");
      } else {
        setError("Verification incomplete — please try again.");
      }
    } catch (err: unknown) {
      const e = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(strategy: "oauth_google" | "oauth_github") {
    if (!signIn) { setError("Auth not ready. Please refresh."); return; }
    setError("");
    setLoading(true);
    try {
      // In Clerk v7, create() mutates signIn in place — return value is undefined
      await (signIn as any).create({
        strategy,
        redirectUrl: `${window.location.origin}/sso-callback`,
        actionCompleteRedirectUrl: `${window.location.origin}/dashboard`,
      });

      // Read from signIn directly after mutation
      const si = signIn as any;
      console.log("signIn.status:", si.status, "fFV:", JSON.stringify(si.firstFactorVerification));

      if (si.status === "complete" && si.createdSessionId) {
        await setActive({ session: si.createdSessionId });
        onClose();
        router.push("/dashboard");
        return;
      }

      const url = si.firstFactorVerification?.externalVerificationRedirectURL;
      const href = typeof url === "string" ? url : url?.href ?? url?.toString?.();
      if (href) {
        window.location.href = href;
      } else {
        setError(`OAuth error (status: ${si.status}). Check console.`);
      }
    } catch (err: unknown) {
      console.error("OAuth error:", err);
      const e = err as { errors?: { longMessage?: string; message?: string }[]; message?: string };
      setError(e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? e?.message ?? "OAuth sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
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
            /* ── Verification step (optional — only shown if Clerk requires it) ── */
            <form onSubmit={handleVerify} className="space-y-4">
              <p className="text-sm text-slate-400">
                We sent a 6-digit code to{" "}
                <span className="font-bold text-white">{tab === "email" ? email : `${country.code}${phone}`}</span>.
                Check your {tab === "email" ? "inbox" : "messages"}.
              </p>
              <div className="flex items-center gap-3 overflow-hidden rounded-2xl bg-[#18191f] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
                <Icon name="verified" fill className="text-[18px] shrink-0 text-slate-500" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder-slate-600 outline-none tracking-[0.2em]"
                  maxLength={6}
                  autoFocus
                />
              </div>
              {error && <p className="rounded-xl bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full rounded-2xl bg-[#05b957] py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-[#07cc63] active:scale-[.98] disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verifying…
                  </span>
                ) : "Verify & Enter"}
              </button>
              <p className="text-center text-xs text-slate-600">
                Check your inbox and enter the 6-digit code to continue.
              </p>
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
                      <div className="animate-dropdown absolute left-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#18191f] shadow-xl">
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

                {/* Clerk CAPTCHA mount point — required for bot protection in production */}
                <div id="clerk-captcha" />

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || !agreed}
                  className="w-full rounded-2xl bg-[#05b957] py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-[#07cc63] active:scale-[.98] disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating account…
                    </span>
                  ) : "Create Account"}
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
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
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
