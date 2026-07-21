"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { Icon } from "@/components/icon";
import { LoadingDots } from "@/components/loading-dots";
import { CountryPicker } from "@/components/country-picker";
import { COUNTRIES, type Country } from "@/lib/countries";
import { toast } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";
import { stashPendingPromo, redeemPromoClient } from "@/lib/pending-promo";
import { showPromoSuccess } from "@/components/promo-success";
import { useSiteConfig } from "@/lib/site-config-context";
import { DEV_AUTH_PUBLIC } from "@/lib/dev-auth";
import "./auth.css";
import "@/components/binarymarket/auth.css";
import "@/components/moneybinary/auth.css";

export type BinaryKeAuthTab = "login" | "register";

type Props = {
  initialTab?: BinaryKeAuthTab;
};

type RecoveryStep = "form" | "email" | "code" | "password";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function normalizeKenyaPhone(phone: string, country: Country): string | null {
  const raw = phone.trim().replace(/\s+/g, "").replace("+", "");
  let normalized = raw;
  if (country.code === "+254") {
    if (normalized.startsWith("0")) normalized = "254" + normalized.slice(1);
    else if (!normalized.startsWith("254") && normalized.length === 9) {
      normalized = "254" + normalized;
    }
    if (!/^254[17]\d{8}$/.test(normalized)) return null;
    return normalized;
  }
  const cleanCode = country.code.replace("+", "");
  if (!normalized.startsWith(cleanCode)) normalized = cleanCode + normalized;
  return normalized;
}

export function BinaryKeAuthPage({ initialTab = "login" }: Props) {
  const { brand } = useSiteConfig();
  const router = useRouter();
  const [tab, setTab] = useState<BinaryKeAuthTab>(initialTab);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [promoCode, setPromoCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [pendingVerify, setPendingVerify] = useState(false);
  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>("form");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmNewPw, setShowConfirmNewPw] = useState(false);

  function switchTab(next: BinaryKeAuthTab) {
    setTab(next);
    setError("");
    setPendingVerify(false);
    setRecoveryStep("form");
    router.replace(next === "login" ? "/sign-in" : "/sign-up", { scroll: false });
  }

  async function goAfterAuth(message: string) {
    toast.success(message, `Welcome to ${brand}`);
    router.push("/binary");
  }

  async function finishSignup(welcomeMsg: string) {
    stashPendingPromo(promoCode);
    const promo = await redeemPromoClient(promoCode || undefined);
    if (promo.ok && promo.amount && promo.code) {
      setTimeout(() => showPromoSuccess({ amount: promo.amount!, code: promo.code! }), 350);
    }
    await goAfterAuth(welcomeMsg);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (DEV_AUTH_PUBLIC) {
      const res = await fetch("/api/dev-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("Incorrect email or password. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = "/binary";
      return;
    }

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(
          authError.message === "Invalid login credentials"
            ? "Incorrect email or password. Please try again."
            : authError.message,
        );
        return;
      }

      const statusResponse = await fetch("/api/auth/account-status", { cache: "no-store" });
      const accountStatus = statusResponse.ok
        ? ((await statusResponse.json()) as { suspended?: boolean })
        : null;
      if (accountStatus?.suspended) {
        await supabase.auth.signOut();
        router.push("/suspended");
        return;
      }

      await goAfterAuth("Welcome back!");
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!phone) {
      setError("Phone number is required for M-Pesa");
      return;
    }
    const normalized = normalizeKenyaPhone(phone, country);
    if (!normalized) {
      setError("Please enter a valid Safaricom number (e.g. 07XX or 01XX).");
      return;
    }

    setLoading(true);
    setError("");

    let deviceId = "";
    try {
      deviceId = localStorage.getItem("nezeem-device-id") ?? "";
      if (!deviceId) {
        deviceId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
        localStorage.setItem("nezeem-device-id", deviceId);
      }
    } catch {
      /* storage blocked */
    }

    try {
      try {
        const gateRes = await fetch("/api/auth/device-gate", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId }),
        });
        const gate = (await gateRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!gateRes.ok || gate.ok === false) {
          setError(gate.error || "This device can't create another account.");
          return;
        }
      } catch {
        /* network blip — login-alert still gates later */
      }

      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: null,
            first_name: null,
            phone_number: normalized,
          },
        },
      });
      if (authError) {
        setError(authError.message);
        return;
      }

      stashPendingPromo(promoCode);
      setPendingVerify(true);
      startResendCooldown();
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
    try {
      const supabase = createClient();
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
            : verifyError.message,
        );
        return;
      }
      await finishSignup("Account verified!");
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
        if (v <= 1) {
          clearInterval(t);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setResending(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
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

  async function handleOAuth() {
    setError("");
    setLoading(true);
    if (tab === "register") stashPendingPromo(promoCode);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  }

  async function handleSendRecoveryCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setRecoveryStep("code");
      toast.info("Code sent", "Check your email for the password reset code.");
    } catch {
      setError("Could not send the reset code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyRecoveryCode(e: React.FormEvent) {
    e.preventDefault();
    if (recoveryCode.trim().length < 6) {
      setError("Enter the six-digit code from your email.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: recoveryCode.trim(),
        type: "recovery",
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }
      setRecoveryStep("password");
    } catch {
      setError("Could not verify the code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      toast.success("Password updated", "You can now log in with your new password.");
      setPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setRecoveryCode("");
      setRecoveryStep("form");
    } catch {
      setError("Could not update your password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const showRecovery = tab === "login" && recoveryStep !== "form";

  return (
    <div className="bok-auth flex min-h-[100dvh] flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <BrandLogo href="/" size="sm" />
        <Link href="/" className="bok-auth-close" aria-label="Back to landing">
          <Icon name="close" className="text-[18px]" />
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-2 sm:items-center sm:pb-16 sm:pt-0">
        <div className="bok-auth-card px-5 py-6 sm:px-7 sm:py-8">
          {!pendingVerify && !showRecovery && (
            <div className="bok-auth-tabs mb-6">
              <button
                type="button"
                className="bok-auth-tab"
                data-active={tab === "login"}
                onClick={() => switchTab("login")}
              >
                Login
              </button>
              <button
                type="button"
                className="bok-auth-tab"
                data-active={tab === "register"}
                onClick={() => switchTab("register")}
              >
                Registration
              </button>
            </div>
          )}

          {pendingVerify ? (
            <form onSubmit={handleVerify} className="space-y-3">
              <h1 className="text-xl font-black tracking-tight">Verify email</h1>
              <p className="text-sm leading-relaxed text-[var(--bok-muted)]">
                Enter the six-digit code sent to <strong className="text-white">{email}</strong>.
              </p>
              <div className="bok-auth-field">
                <Icon name="verified" fill className="shrink-0 text-[18px] text-[var(--bok-muted)]" />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setCode(v);
                    if (v.length === 6) void handleVerify(undefined, v);
                  }}
                  placeholder="000000"
                  className="text-center text-xl font-black tracking-[0.45em]"
                />
              </div>
              {error && (
                <p className="rounded-xl bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400">{error}</p>
              )}
              <button type="submit" disabled={loading || code.length < 6} className="bok-auth-cta">
                {loading ? <LoadingDots label="Verifying" /> : "Verify & continue"}
              </button>
              <p className="text-center text-xs text-[var(--bok-muted)]">
                Still nothing?{" "}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || resending}
                  className="bok-auth-link disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {resending ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </p>
            </form>
          ) : showRecovery ? (
            <div className="space-y-3">
              <h1 className="text-xl font-black tracking-tight">
                {recoveryStep === "email"
                  ? "Reset password"
                  : recoveryStep === "code"
                    ? "Enter code"
                    : "New password"}
              </h1>
              <p className="text-sm leading-relaxed text-[var(--bok-muted)]">
                {recoveryStep === "email" && "Enter the email address connected to your account."}
                {recoveryStep === "code" && (
                  <>
                    Enter the six-digit code sent to <strong className="text-white">{email}</strong>.
                  </>
                )}
                {recoveryStep === "password" && "Choose a new password for your account."}
              </p>

              {recoveryStep === "email" && (
                <form onSubmit={handleSendRecoveryCode} className="space-y-3">
                  <div className="bok-auth-field">
                    <Icon name="mail" fill className="shrink-0 text-[18px] text-[var(--bok-muted)]" />
                    <input
                      type="email"
                      autoFocus
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>
                  {error && (
                    <p className="rounded-xl bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400">{error}</p>
                  )}
                  <button type="submit" disabled={loading} className="bok-auth-cta">
                    {loading ? <LoadingDots label="Sending code" /> : "Send reset code"}
                  </button>
                </form>
              )}

              {recoveryStep === "code" && (
                <form onSubmit={handleVerifyRecoveryCode} className="space-y-3">
                  <div className="bok-auth-field">
                    <Icon name="verified" fill className="shrink-0 text-[18px] text-[var(--bok-muted)]" />
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      required
                      maxLength={6}
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      className="text-center text-xl font-black tracking-[0.45em]"
                    />
                  </div>
                  {error && (
                    <p className="rounded-xl bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading || recoveryCode.length !== 6}
                    className="bok-auth-cta"
                  >
                    {loading ? <LoadingDots label="Verifying" /> : "Verify code"}
                  </button>
                </form>
              )}

              {recoveryStep === "password" && (
                <form onSubmit={handleUpdatePassword} className="space-y-3">
                  <div className="bok-auth-field">
                    <Icon name="lock" fill className="shrink-0 text-[18px] text-[var(--bok-muted)]" />
                    <input
                      type={showNewPw ? "text" : "password"}
                      autoFocus
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((v) => !v)}
                      className="text-[var(--bok-muted)] transition hover:text-white"
                      aria-label={showNewPw ? "Hide password" : "Show password"}
                    >
                      <Icon name={showNewPw ? "visibility_off" : "visibility"} className="text-[18px]" />
                    </button>
                  </div>
                  <div className="bok-auth-field">
                    <Icon name="lock" fill className="shrink-0 text-[18px] text-[var(--bok-muted)]" />
                    <input
                      type={showConfirmNewPw ? "text" : "password"}
                      required
                      minLength={8}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPw((v) => !v)}
                      className="text-[var(--bok-muted)] transition hover:text-white"
                      aria-label={showConfirmNewPw ? "Hide password" : "Show password"}
                    >
                      <Icon name={showConfirmNewPw ? "visibility_off" : "visibility"} className="text-[18px]" />
                    </button>
                  </div>
                  {error && (
                    <p className="rounded-xl bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400">{error}</p>
                  )}
                  <button type="submit" disabled={loading} className="bok-auth-cta">
                    {loading ? <LoadingDots label="Updating password" /> : "Update password"}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setRecoveryStep("form");
                }}
                className="w-full pt-1 text-sm font-bold text-[var(--bok-muted)] transition hover:text-white"
              >
                Back to login
              </button>
            </div>
          ) : tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="bok-auth-field">
                <Icon name="mail" fill className="shrink-0 text-[18px] text-[var(--bok-muted)]" />
                <input
                  type="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                />
              </div>
              <div className="bok-auth-field">
                <Icon name="lock" fill className="shrink-0 text-[18px] text-[var(--bok-muted)]" />
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="text-[var(--bok-muted)] transition hover:text-white"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  <Icon name={showPw ? "visibility_off" : "visibility"} className="text-[18px]" />
                </button>
              </div>

              {error && (
                <p className="rounded-xl bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400">{error}</p>
              )}

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setRecoveryStep("email");
                  }}
                  className="bok-auth-link text-xs"
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" disabled={loading} className="bok-auth-cta">
                {loading ? <LoadingDots label="Logging in" /> : "Log in"}
              </button>

              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--bok-muted)]">
                  Or continue with
                </span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>

              {!DEV_AUTH_PUBLIC && (
                <button type="button" onClick={handleOAuth} disabled={loading} className="bok-auth-social">
                  <GoogleIcon />
                  Continue with Google
                </button>
              )}
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="bok-auth-field">
                <Icon name="mail" fill className="shrink-0 text-[18px] text-[var(--bok-muted)]" />
                <input
                  type="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                />
              </div>

              <div className="bok-auth-field !gap-0 !px-0">
                <CountryPicker value={country} onChange={setCountry} />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="700 000000 (M-Pesa)"
                  className="!px-4"
                />
              </div>

              <div className="bok-auth-field">
                <Icon name="lock" fill className="shrink-0 text-[18px] text-[var(--bok-muted)]" />
                <input
                  type={showPw ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="text-[var(--bok-muted)] transition hover:text-white"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  <Icon name={showPw ? "visibility_off" : "visibility"} className="text-[18px]" />
                </button>
              </div>

              <div
                className={`bok-auth-field ${
                  confirmPassword && password !== confirmPassword ? "!shadow-[inset_0_0_0_1px_rgba(248,113,113,0.5)]" : ""
                }`}
              >
                <Icon name="lock" fill className="shrink-0 text-[18px] text-[var(--bok-muted)]" />
                <input
                  type={showConfirmPw ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw((v) => !v)}
                  className="text-[var(--bok-muted)] transition hover:text-white"
                  aria-label={showConfirmPw ? "Hide password" : "Show password"}
                >
                  <Icon name={showConfirmPw ? "visibility_off" : "visibility"} className="text-[18px]" />
                </button>
              </div>

              <div className="bok-auth-field">
                <Icon name="confirmation_number" fill className="shrink-0 text-[18px] text-[var(--bok-muted)]" />
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Promo code (optional)"
                  autoComplete="off"
                  className="font-bold tracking-wider"
                />
              </div>

              {error && (
                <p className="rounded-xl bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400">{error}</p>
              )}

              <label className="flex cursor-pointer items-start gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setAgreed((v) => !v)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                    agreed
                      ? "border-[var(--bok-lime)] bg-[var(--bok-lime)] text-[var(--bok-lime-ink)]"
                      : "border-white/20 bg-white/5"
                  }`}
                  aria-pressed={agreed}
                  aria-label="Agree to terms"
                >
                  {agreed && <Icon name="check" className="text-[13px]" />}
                </button>
                <span className="text-[11px] leading-4 text-[var(--bok-muted)]">
                  I agree to the{" "}
                  <Link href="/terms" className="bok-auth-link">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="bok-auth-link">
                    Privacy Policy
                  </Link>
                  . I confirm I am 18+ years old.
                </span>
              </label>

              <button type="submit" disabled={loading || !agreed} className="bok-auth-cta">
                {loading ? <LoadingDots label="Creating account" /> : "Create account"}
              </button>

              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--bok-muted)]">
                  Or continue with
                </span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>

              <button type="button" onClick={handleOAuth} disabled={loading} className="bok-auth-social">
                <GoogleIcon />
                Continue with Google
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
