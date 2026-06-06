"use client";

import { Suspense, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icon";

function TwoFactorContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const next         = searchParams.get("next") ?? "/";

  const [code, setCode]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#087cff]/15 ring-1 ring-[#087cff]/25">
            <Icon name="security" fill className="text-[32px] text-[#087cff]" />
          </div>
          <h1 className="text-2xl font-black text-white">Two-Factor Authentication</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">
            Open Google Authenticator and enter the 6-digit code for <strong className="text-slate-300">Nezeem</strong>.
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

        <p className="text-center text-xs font-bold text-slate-600">
          Lost access to your authenticator? Contact{" "}
          <a href="mailto:support@nezeem.com" className="text-[#5ea9ff] transition hover:text-white">
            support@nezeem.com
          </a>
        </p>
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
