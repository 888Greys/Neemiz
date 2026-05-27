"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

interface Props {
  totpEnabled: boolean;
  adminEmail: string;
}

function Spinner() {
  return <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />;
}

export function Admin2FAClient({ totpEnabled, adminEmail }: Props) {
  const router = useRouter();

  // ── Setup state ──
  const [setupData, setSetupData]   = useState<{ secret: string; uri: string } | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");

  // ── Verify state ──
  const [code, setCode]           = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError]     = useState("");
  const [copied, setCopied]       = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [setupData, totpEnabled]);

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
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(setupData.uri)}&bgcolor=ffffff&color=000000&margin=8&qzone=1`
    : null;

  // ── Already enabled → just verify ──────────────────────────────────────────
  if (totpEnabled && !setupData) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#087cff]/15 ring-1 ring-[#087cff]/30">
              <Icon name="security" fill className="text-[32px] text-[#087cff]" />
            </div>
            <h1 className="text-2xl font-black text-white">Admin Verification</h1>
            <p className="mt-2 text-sm text-slate-500">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          {/* Code input */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.08] focus-within:ring-[#087cff]/50 transition">
              <Icon name="pin" fill className="shrink-0 text-[20px] text-slate-500" />
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
                className="flex-1 bg-transparent py-4 text-center font-mono text-2xl font-black tracking-[0.3em] text-white outline-none placeholder:text-slate-700"
              />
            </div>

            {verifyError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2.5 ring-1 ring-red-500/20">
                <Icon name="error" fill className="shrink-0 text-[15px] text-red-400" />
                <p className="text-xs font-bold text-red-400">{verifyError}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => verify()}
              disabled={verifyLoading || code.replace(/\s/g, "").length !== 6}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#087cff] text-base font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#2a90ff] active:scale-[.98] disabled:opacity-50"
            >
              {verifyLoading ? <Spinner /> : "Verify & Enter Admin"}
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-slate-600">
            Signed in as <span className="text-slate-400">{adminEmail}</span>
          </p>
        </div>
      </div>
    );
  }

  // ── First time setup ────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/15 ring-1 ring-amber-400/25">
            <Icon name="shield_lock" fill className="text-[32px] text-amber-400" />
          </div>
          <h1 className="text-2xl font-black text-white">Set Up 2FA</h1>
          <p className="mt-2 text-sm text-slate-500">
            Admin access requires authenticator app verification
          </p>
        </div>

        {!setupData ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#16171d] p-5 ring-1 ring-white/[0.07]">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#087cff]/20 text-[11px] font-black text-[#087cff]">1</span>
                <p className="text-sm font-black text-white">Install an authenticator app</p>
              </div>
              <p className="ml-9 text-xs text-slate-500">
                Google Authenticator, Authy, or Microsoft Authenticator
              </p>
            </div>
            <div className="rounded-2xl bg-[#16171d] p-5 ring-1 ring-white/[0.07]">
              <div className="mb-1 flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#087cff]/20 text-[11px] font-black text-[#087cff]">2</span>
                <p className="text-sm font-black text-white">Scan the QR code</p>
              </div>
              <p className="ml-9 text-xs text-slate-500">
                Click below to generate your QR code
              </p>
            </div>
            <div className="rounded-2xl bg-[#16171d] p-5 ring-1 ring-white/[0.07]">
              <div className="mb-1 flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#087cff]/20 text-[11px] font-black text-[#087cff]">3</span>
                <p className="text-sm font-black text-white">Enter the 6-digit code</p>
              </div>
              <p className="ml-9 text-xs text-slate-500">
                Verify your setup to complete enrollment
              </p>
            </div>

            {setupError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2.5 ring-1 ring-red-500/20">
                <Icon name="error" fill className="shrink-0 text-[15px] text-red-400" />
                <p className="text-xs font-bold text-red-400">{setupError}</p>
              </div>
            )}

            <button
              type="button"
              onClick={startSetup}
              disabled={setupLoading}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-base font-black text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-[.98] disabled:opacity-50"
            >
              {setupLoading ? <Spinner /> : <>
                <Icon name="qr_code_2" className="text-[20px]" />
                Generate QR Code
              </>}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* QR code */}
            <div className="flex flex-col items-center rounded-2xl bg-white p-5">
              {qrUrl && (
                <img src={qrUrl} alt="Authenticator QR code" width={200} height={200} className="rounded-xl" />
              )}
              <p className="mt-3 text-center text-xs font-bold text-slate-700">
                Scan with your authenticator app
              </p>
            </div>

            {/* Manual entry */}
            <div className="rounded-xl bg-[#16171d] px-4 py-3 ring-1 ring-white/[0.07]">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                Can&apos;t scan? Enter manually
              </p>
              <div className="flex items-center gap-2">
                <p className="flex-1 break-all font-mono text-xs text-slate-300">{setupData.secret}</p>
                <button type="button" onClick={copySecret} className="shrink-0 text-slate-500 hover:text-[#087cff] transition-colors">
                  <Icon name={copied ? "check" : "content_copy"} className={`text-[16px] ${copied ? "text-[#31c45d]" : ""}`} />
                </button>
              </div>
            </div>

            {/* Code verification */}
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                Enter the 6-digit code to confirm setup
              </p>
              <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.08] focus-within:ring-[#087cff]/50 transition">
                <Icon name="pin" fill className="shrink-0 text-[20px] text-slate-500" />
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
                  className="flex-1 bg-transparent py-4 text-center font-mono text-2xl font-black tracking-[0.3em] text-white outline-none placeholder:text-slate-700"
                />
              </div>
            </div>

            {verifyError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2.5 ring-1 ring-red-500/20">
                <Icon name="error" fill className="shrink-0 text-[15px] text-red-400" />
                <p className="text-xs font-bold text-red-400">{verifyError}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => verify(true)}
              disabled={verifyLoading || code.replace(/\s/g, "").length !== 6}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#087cff] text-base font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#2a90ff] active:scale-[.98] disabled:opacity-50"
            >
              {verifyLoading ? <Spinner /> : "Activate 2FA & Enter Admin"}
            </button>

            <button
              type="button"
              onClick={() => setSetupData(null)}
              className="w-full text-center text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              Start over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
