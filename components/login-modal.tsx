"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { LoadingDots } from "@/components/loading-dots";
import { CountryPicker } from "@/components/country-picker";
import { COUNTRIES, type Country } from "@/lib/countries";
import { toast } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";

function TgIcon() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none">
      <path d="M20.7 4.1 3.9 10.6c-1.1.4-1.1 1.1-.2 1.4l4.3 1.3 1.7 5.2c.2.6.3.8.7.8.4 0 .6-.2.9-.5l2.1-2 4.4 3.2c.8.4 1.3.2 1.5-.8l2.7-12.8c.3-1.2-.5-1.7-1.3-1.3Z" fill="currentColor" />
      <path d="m8.7 13 8.8-5.6c.4-.3.8-.1.5.2l-7.1 6.5-.3 3.1-1.9-4.2Z" fill="#111316" opacity=".55" />
    </svg>
  );
}

type Props = {
  onClose: () => void;
  onSwitchToRegister?: () => void;
};

export function LoginModal({ onClose, onSwitchToRegister }: Props) {
  const [tab, setTab]           = useState<"phone" | "email">("email");
  const [country, setCountry]   = useState<Country>(COUNTRIES[0]);
  const [phone, setPhone]       = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    try {
      // For phone tab we use the phone number as the email identifier
      // (Supabase phone+password requires an SMS provider — use email-style phone for now)
      const identifier = tab === "email" ? email : `${country.code}${phone}`.replace("+", "") + "@phone.nezeem.com";

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: identifier,
        password,
      });

      if (authError) {
        setError(authError.message === "Invalid login credentials"
          ? "Incorrect email or password. Please try again."
          : authError.message);
        return;
      }

      onClose();
      toast.success("Welcome back!", "You have successfully logged in.");
      router.push("/dashboard");
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    setError("");
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (authError) {
      setError(authError.message);
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
          <h2 className="text-2xl font-black text-white">Login</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-slate-400 transition hover:bg-white/10 hover:text-white"
            type="button"
            aria-label="Close"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 pb-8 sm:px-7 sm:pb-7" style={{ maxHeight: "85dvh" }}>
          {/* Tab switcher */}
          <div className="mb-5 grid grid-cols-2 gap-1.5 rounded-2xl bg-[#18191f] p-1">
            {(["phone", "email"] as const).map((t) => (
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
            {/* Phone / email input */}
            {tab === "phone" ? (
              <div className="flex rounded-2xl bg-[#18191f] ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
                <CountryPicker value={country} onChange={setCountry} />
                <input
                  type="tel"
                  autoFocus
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="700 000000"
                  className="flex-1 bg-transparent px-4 py-3.5 text-sm text-white placeholder-slate-600 outline-none"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 overflow-hidden rounded-2xl bg-[#18191f] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
                <Icon name="mail" fill className="text-[18px] shrink-0 text-slate-500" />
                <input
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder-slate-600 outline-none"
                />
              </div>
            )}

            {/* Password */}
            <div className="flex items-center gap-3 overflow-hidden rounded-2xl bg-[#18191f] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
              <Icon name="lock" fill className="text-[18px] shrink-0 text-slate-500" />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder-slate-600 outline-none"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="text-slate-500 transition hover:text-slate-300">
                <Icon name={showPw ? "visibility_off" : "visibility"} className="text-[18px]" />
              </button>
            </div>

            {error && <p className="rounded-xl bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400">{error}</p>}

            {/* Forgot */}
            <div className="text-right">
              <button
                type="button"
                onClick={() => toast.info("Password reset", "Check your email for a reset link after entering your email above and clicking below.")}
                className="text-xs font-bold text-[#087cff] transition hover:text-blue-400"
              >
                Forgot your password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#05b957] py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-[#07cc63] active:scale-[.98] disabled:opacity-60"
            >
              {loading ? <LoadingDots label="Logging in" /> : "Log in"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 border-t border-white/[0.07]" />
            <span className="text-xs text-slate-600">or</span>
            <div className="flex-1 border-t border-white/[0.07]" />
          </div>

          {/* Social */}
          <div className="flex justify-center gap-2.5">
            {/* Google */}
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              aria-label="Sign in with Google"
              className="flex h-11 items-center justify-center gap-2.5 rounded-xl bg-[#18191f] px-5 ring-1 ring-white/[0.07] transition hover:bg-[#22252e]"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span className="text-sm font-black text-white">Continue with Google</span>
            </button>
          </div>

          {/* Switch to register */}
          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="font-black text-[#087cff] transition hover:text-blue-400"
            >
              Register
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
