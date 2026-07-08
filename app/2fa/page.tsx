"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icon";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

function TwoFactorContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const next         = searchParams.get("next") ?? "/";
  const { user }     = useSupabaseAuth();

  const emailOtpPreferred = user?.user_metadata?.email_otp_enabled === true;

  const [code, setCode]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSent = useRef(false);

  async function sendEmailCode() {
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/email/send", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not send email code");
        return;
      }
      setMaskedEmail(typeof data.maskedEmail === "string" ? data.maskedEmail : "");
      setEmailSent(true);
    } catch {
      setError("Could not send email code — try again.");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!emailOtpPreferred || autoSent.current) return;
    autoSent.current = true;
    void sendEmailCode();
  }, [emailOtpPreferred]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) { setError("Enter your 6-digit code"); return; }
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/2fa/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: digits }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Verification failed"); return; }
      router.replace(next);
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0c0d10] px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#087cff]/15 ring-1 ring-[#087cff]/25">
            <Icon name="security" fill className="text-[32px] text-[#087cff]" />
          </div>
          <h1 className="text-2xl font-black text-white">Two-Factor Authentication</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">
            {emailOtpPreferred
              ? (
                <>
                  Enter the 6-digit code we emailed
                  {maskedEmail ? <> to <strong className="text-slate-300">{maskedEmail}</strong></> : null}.
                </>
              )
              : (
                <>
                  Open Google Authenticator and enter the 6-digit code for <strong className="text-slate-300">Nezeem</strong>.
                </>
              )}
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(v);
              setError("");
            }}
            placeholder="000000"
            maxLength={6}
            autoFocus
            className="h-16 w-full rounded-2xl bg-white/[0.06] text-center text-3xl font-black tracking-[0.3em] text-white outline-none ring-1 ring-white/[0.09] transition focus:bg-white/[0.09] focus:ring-2 focus:ring-[#087cff]/60 placeholder:text-slate-700"
          />

          {error && (
            <p className="rounded-xl bg-red-500/10 px-4 py-3 text-center text-sm font-bold text-red-300 ring-1 ring-red-500/20">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || code.replace(/\D/g, "").length !== 6}
            className="h-14 w-full rounded-2xl bg-[#087cff] text-base font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#1990ff] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-slate-500 disabled:shadow-none"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Verifying…
              </span>
            ) : "Verify"}
          </button>
        </form>

        {emailOtpPreferred ? (
          <button
            type="button"
            onClick={() => void sendEmailCode()}
            disabled={sending}
            className="w-full text-center text-xs font-bold text-[#5ea9ff] transition hover:text-white disabled:opacity-50"
          >
            {sending ? "Sending…" : emailSent ? "Resend email code" : "Send email code"}
          </button>
        ) : (
          <p className="text-center text-xs font-bold text-slate-600">
            Lost access to your authenticator? Contact{" "}
            <a href="mailto:support@nezeem.com" className="text-[#5ea9ff] transition hover:text-white">
              support@nezeem.com
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

export default function TwoFactorPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0c0d10]" />}>
      <TwoFactorContent />
    </Suspense>
  );
}
