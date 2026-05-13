"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { Icon } from "@/components/icon";

type Mode = "login" | "signup";

export function LoginPanel({ initialMode }: { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [joined, setJoined] = useState(false);

  if (joined) {
    return (
      <AuthShell>
        <div className="rounded-2xl border border-white/10 bg-[#0f1018]/95 p-4 text-center shadow-2xl shadow-black/30 sm:p-5">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon name="check_circle" fill className="text-[26px]" />
          </div>
          <h1 className="text-lg font-bold">You are on the Nezeem waitlist</h1>
          <p className="mt-2 text-xs leading-5 text-on-surface-variant">
            Thank you for requesting early access. We are finalizing the live betting, wallet, P2P, prediction market, and trading features. You will be notified as soon as your account is ready.
          </p>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left text-xs leading-5 text-on-surface-variant">
            <div className="mb-1 font-semibold text-on-surface">What happens next</div>
            <p>Our team will open access in launch waves and send an invitation to the email or phone number you provided.</p>
          </div>
          <Link href="/" className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary-container">
            Back to launch page
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <section className="rounded-2xl border border-white/10 bg-[#0f1018]/95 p-3.5 shadow-2xl shadow-black/30 sm:p-5">
        <div className="mb-4 text-center">
          <Link href="/" className="inline-flex">
            <BrandLogo size="sm" />
          </Link>
          <p className="mt-2 text-xs text-on-surface-variant">
            {mode === "login" ? "Access your launch preview account." : "Reserve early access before public launch."}
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-xl bg-white/[0.04] p-1">
          <button
            className={`rounded-lg py-2 text-sm font-medium transition ${mode === "login" ? "bg-white/10 text-primary shadow-sm" : "text-on-surface-variant"}`}
            onClick={() => setMode("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={`rounded-lg py-2 text-sm font-medium transition ${mode === "signup" ? "bg-white/10 text-primary shadow-sm" : "text-on-surface-variant"}`}
            onClick={() => setMode("signup")}
            type="button"
          >
            Sign Up
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-xs transition hover:bg-white/[0.06]">
            <Icon name="language" className="text-[17px]" />
            Google
          </button>
          <button className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-xs transition hover:bg-white/[0.06]">
            <Icon name="phone_iphone" className="text-[17px]" />
            Phone
          </button>
        </div>

        <div className="mb-4 flex items-center">
          <div className="flex-grow border-t border-white/10" />
          <span className="px-3 text-[10px] uppercase tracking-widest text-on-surface-variant">or</span>
          <div className="flex-grow border-t border-white/10" />
        </div>

        {mode === "login" ? <LoginForm /> : <SignupForm onJoin={() => setJoined(true)} />}

        <p className="mt-4 px-2 text-center text-[10px] leading-4 text-on-surface-variant">
          By continuing, you agree to our <a className="text-on-surface underline" href="#">Terms</a> and <a className="text-on-surface underline" href="#">Privacy Policy</a>.
        </p>
      </section>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-3 py-4 text-on-surface">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(4,180,162,0.10),transparent_30%)]" />
      <div className="relative w-full max-w-[320px] sm:max-w-sm">{children}</div>
    </main>
  );
}

function LoginForm() {
  return (
    <form className="space-y-3">
      <Field id="identifier" label="Email or Phone" placeholder="Enter your credentials" type="text" />
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant" htmlFor="password">Password</label>
        <div className="relative">
          <input id="password" className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none transition focus:border-primary" placeholder="••••••••" type="password" />
          <button className="absolute inset-y-0 right-3 text-on-surface-variant" type="button">
            <Icon name="visibility_off" className="text-[18px]" />
          </button>
        </div>
        <div className="mt-1.5 text-right"><a className="text-xs text-primary" href="#">Forgot Password?</a></div>
      </div>
      <button className="h-10 w-full rounded-xl bg-primary-container text-sm font-semibold text-on-background transition hover:bg-primary" type="button">
        Sign In
      </button>
      <p className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-[10px] leading-4 text-on-surface-variant">
        Live accounts are not active yet. Existing preview users can sign in once access is enabled.
      </p>
    </form>
  );
}

function SignupForm({ onJoin }: { onJoin: () => void }) {
  return (
    <form className="space-y-3">
      <Field id="name" label="Full Name" placeholder="Your legal name" type="text" />
      <Field id="signup-contact" label="Email or Phone" placeholder="Where should we notify you?" type="text" />
      <Field id="country" label="Country" placeholder="Country of residence" type="text" />
      <button className="h-10 w-full rounded-xl bg-primary-container text-sm font-semibold text-on-background transition hover:bg-primary" onClick={onJoin} type="button">
        Join Waitlist
      </button>
      <p className="rounded-xl border border-primary/25 bg-primary/10 p-2.5 text-[10px] leading-4 text-on-surface-variant">
        Nezeem is currently in launch preparation. Creating an account reserves your place; we will notify you when deposits, betting, P2P, and trading features are available.
      </p>
    </form>
  );
}

function Field({ id, label, placeholder, type }: { id: string; label: string; placeholder: string; type: string }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant" htmlFor={id}>{label}</label>
      <input id={id} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none transition focus:border-primary" placeholder={placeholder} type={type} />
    </div>
  );
}
