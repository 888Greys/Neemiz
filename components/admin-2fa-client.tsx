"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

interface Props {
  totpEnabled: boolean;
  adminEmail: string;
}

function Spinner() {
  return <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />;
}

export function Admin2FAClient({ totpEnabled, adminEmail }: Props) {
  const router = useRouter();

  const [setupData, setSetupData]       = useState<{ secret: string; uri: string } | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError]     = useState("");

  const [code, setCode]                     = useState("");
  const [verifyLoading, setVerifyLoading]   = useState(false);
  const [verifyError, setVerifyError]       = useState("");
  const [copied, setCopied]                 = useState(false);

  const [emailSending, setEmailSending]     = useState(false);
  const [emailSentTo, setEmailSentTo]       = useState("");
  const [emailError, setEmailError]         = useState("");

  async function sendEmailCode() {
    setEmailSending(true);
    setEmailError("");
    setEmailSentTo("");
    try {
      const res  = await fetch("/api/admin/2fa/email-code", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send code");
      setEmailSentTo(data.sentTo ?? "your email");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setEmailSending(false);
    }
  }

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [setupData, totpEnabled]);

  async function startSetup() {
    setSetupLoading(true);
    setSetupError("");
    try {
      const res  = await fetch("/api/admin/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Setup failed");
      setSetupData(data as { secret: string; uri: string });
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setSetupLoading(false);
    }
  }

  async function verify(isSetup = false) {
    if (code.replace(/\s/g, "").length !== 6) {
      setVerifyError("Enter the 6-digit code from your authenticator app");
      return;
    }
    setVerifyLoading(true);
    setVerifyError("");
    try {
      const res  = await fetch("/api/admin/2fa/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: code.replace(/\s/g, "") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      router.replace("/admin");
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verification failed");
      setCode("");
      inputRef.current?.focus();
      void isSetup;
    } finally {
      setVerifyLoading(false);
    }
  }

  function copySecret() {
    if (!setupData) return;
    navigator.clipboard.writeText(setupData.secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const qrUrl = setupData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(setupData.uri)}&bgcolor=ffffff&color=000000&margin=12&qzone=1`
    : null;

  // ── Already enabled → verify ────────────────────────────────────────────────
  if (totpEnabled && !setupData) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-[360px]">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#087cff]/10 ring-1 ring-[#087cff]/20">
              <Icon name="lock" className="text-[#087cff]" size={22} />
            </div>
            <h1 className="text-[22px] font-black text-white tracking-tight">Two-factor auth</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Enter the code from your authenticator app, or email yourself one
            </p>
          </div>

          <div className="space-y-3">
            <div className={`flex items-center gap-3 rounded-2xl bg-[#111318] px-4 ring-1 transition ${verifyError ? "ring-red-500/40" : "ring-white/[0.07] focus-within:ring-[#087cff]/40"}`}>
              <Icon name="qr_code" className="shrink-0 text-slate-600" size={16} />
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={7}
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/[^0-9\s]/g, "")); setVerifyError(""); }}
                onKeyDown={(e) => e.key === "Enter" && verify()}
                placeholder="000 000"
                className="flex-1 bg-transparent py-4 text-center font-mono text-xl font-black tracking-[0.35em] text-white outline-none placeholder:text-slate-700"
              />
            </div>

            {verifyError && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                <Icon name="error" size={13} />
                {verifyError}
              </p>
            )}

            <button
              type="button"
              onClick={() => verify()}
              disabled={verifyLoading || code.replace(/\s/g, "").length !== 6}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#087cff] text-sm font-black text-white transition hover:bg-[#1a87ff] active:scale-[.98] disabled:opacity-40"
            >
              {verifyLoading ? <Spinner /> : "Continue to Admin"}
            </button>

            {/* Email fallback — for when the authenticator app isn't available. */}
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={sendEmailCode}
                disabled={emailSending}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-300 disabled:opacity-50"
              >
                {emailSending ? <Spinner /> : <Icon name="mail" size={13} />}
                Send code to email
              </button>
              {emailSentTo && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-[#31c45d]">
                  <Icon name="check" size={13} />
                  Code sent to {emailSentTo}
                </p>
              )}
              {emailError && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-red-400">
                  <Icon name="error" size={13} />
                  {emailError}
                </p>
              )}
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-700">
            {adminEmail}
          </p>
        </div>
      </div>
    );
  }

  // ── First-time setup ─────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[360px]">
        {!setupData ? (
          <>
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] ring-1 ring-white/10">
                <Icon name="security" className="text-slate-300" size={22} />
              </div>
              <h1 className="text-[22px] font-black text-white tracking-tight">Secure your account</h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Admin access requires authenticator app verification
              </p>
            </div>

            <div className="mb-6 space-y-px">
              {[
                { n: "1", label: "Install an authenticator app", sub: "Google Authenticator, Authy, or 1Password" },
                { n: "2", label: "Scan the QR code", sub: "We'll generate it in the next step" },
                { n: "3", label: "Enter the 6-digit code", sub: "Complete enrollment to gain access" },
              ].map(({ n, label, sub }, i) => (
                <div key={n} className={`flex gap-4 px-4 py-4 bg-[#111318] ${i === 0 ? "rounded-t-2xl" : i === 2 ? "rounded-b-2xl" : ""} border-b border-white/[0.04] last:border-0`}>
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-black text-slate-400">
                    {n}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">{label}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {setupError && (
              <p className="mb-4 flex items-center gap-1.5 text-xs font-medium text-red-400">
                <Icon name="error" size={13} />
                {setupError}
              </p>
            )}

            <button
              type="button"
              onClick={startSetup}
              disabled={setupLoading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-black transition hover:bg-slate-100 active:scale-[.98] disabled:opacity-40"
            >
              {setupLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
              ) : (
                <>
                  <Icon name="qr_code" size={16} />
                  Generate QR code
                </>
              )}
            </button>

            <p className="mt-5 text-center text-xs text-slate-700">{adminEmail}</p>
          </>
        ) : (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-[22px] font-black text-white tracking-tight">Scan & verify</h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Scan with your authenticator app, then enter the code below
              </p>
            </div>

            {/* QR code */}
            <div className="mb-4 flex justify-center rounded-2xl bg-white p-5">
              {qrUrl && (
                <img src={qrUrl} alt="2FA QR code" width={200} height={200} className="rounded-lg" />
              )}
            </div>

            {/* Manual key */}
            <div className="mb-5 rounded-2xl bg-[#111318] px-4 py-3 ring-1 ring-white/[0.07]">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600">
                Can&apos;t scan? Enter manually
              </p>
              <div className="flex items-center gap-2">
                <p className="flex-1 break-all font-mono text-xs text-slate-400">{setupData.secret}</p>
                <button type="button" onClick={copySecret} className="shrink-0 transition text-slate-600 hover:text-white">
                  <Icon name={copied ? "check" : "qr_code"} size={14} className={copied ? "text-[#31c45d]" : ""} />
                </button>
              </div>
            </div>

            {/* Code input */}
            <div className={`mb-3 flex items-center gap-3 rounded-2xl bg-[#111318] px-4 ring-1 transition ${verifyError ? "ring-red-500/40" : "ring-white/[0.07] focus-within:ring-[#087cff]/40"}`}>
              <Icon name="lock" className="shrink-0 text-slate-600" size={15} />
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={7}
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/[^0-9\s]/g, "")); setVerifyError(""); }}
                onKeyDown={(e) => e.key === "Enter" && verify(true)}
                placeholder="000 000"
                className="flex-1 bg-transparent py-4 text-center font-mono text-xl font-black tracking-[0.35em] text-white outline-none placeholder:text-slate-700"
              />
            </div>

            {verifyError && (
              <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-red-400">
                <Icon name="error" size={13} />
                {verifyError}
              </p>
            )}

            <button
              type="button"
              onClick={() => verify(true)}
              disabled={verifyLoading || code.replace(/\s/g, "").length !== 6}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#087cff] text-sm font-black text-white transition hover:bg-[#1a87ff] active:scale-[.98] disabled:opacity-40 mb-3"
            >
              {verifyLoading ? <Spinner /> : "Activate & enter admin"}
            </button>

            <button
              type="button"
              onClick={() => { setSetupData(null); setCode(""); setVerifyError(""); }}
              className="w-full text-center text-xs text-slate-700 hover:text-slate-500 transition-colors"
            >
              Start over
            </button>
          </>
        )}
      </div>
    </div>
  );
}
