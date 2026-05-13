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
        <div className="rounded-xl border border-outline-variant bg-surface-container p-6 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon name="check_circle" fill className="text-[32px]" />
          </div>
          <h1 className="text-2xl font-bold">You are on the Nezeem waitlist</h1>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant">
            Thank you for requesting early access. We are finalizing the live betting, wallet, P2P, prediction market, and trading features. You will be notified as soon as your account is ready.
          </p>
          <div className="mt-5 rounded border border-outline-variant bg-surface-dim p-3 text-left text-sm text-on-surface-variant">
            <div className="mb-1 font-semibold text-on-surface">What happens next</div>
            <p>Our team will open access in launch waves and send an invitation to the email or phone number you provided.</p>
          </div>
          <Link href="/" className="mt-6 inline-flex w-full items-center justify-center rounded bg-primary-container px-4 py-3 font-semibold text-on-primary-container">
            Back to launch page
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-8 text-center">
        <Link href="/" className="text-3xl font-black uppercase tracking-tight text-primary">
          <BrandLogo size="md" />
        </Link>
        <p className="mt-3 text-sm text-on-surface-variant">
          {mode === "login" ? "Access your launch preview account." : "Reserve early access before public launch."}
        </p>
      </div>

      <div className="mb-6 flex border-b border-outline-variant">
        <button
          className={`flex-1 pb-3 text-center transition ${mode === "login" ? "border-b-2 border-primary text-primary" : "text-on-surface-variant"}`}
          onClick={() => setMode("login")}
          type="button"
        >
          Login
        </button>
        <button
          className={`flex-1 pb-3 text-center transition ${mode === "signup" ? "border-b-2 border-primary text-primary" : "text-on-surface-variant"}`}
          onClick={() => setMode("signup")}
          type="button"
        >
          Sign Up
        </button>
      </div>

      {mode === "login" ? <LoginForm /> : <SignupForm onJoin={() => setJoined(true)} />}

      <div className="my-6 flex items-center">
        <div className="flex-grow border-t border-outline-variant" />
        <span className="px-4 text-xs uppercase tracking-widest text-on-surface-variant">or</span>
        <div className="flex-grow border-t border-outline-variant" />
      </div>

      <div className="space-y-2">
        <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant py-3 transition hover:bg-surface-variant">
          <Icon name="language" className="text-[20px]" />
          Continue with Google
        </button>
        <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant py-3 transition hover:bg-surface-variant">
          <Icon name="phone_iphone" className="text-[20px]" />
          Continue with phone
        </button>
      </div>

      <p className="mt-8 px-4 text-center text-sm text-on-surface-variant">
        By continuing, you agree to our <a className="text-on-surface underline" href="#">Terms of Service</a> and <a className="text-on-surface underline" href="#">Privacy Policy</a>.
      </p>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 text-on-surface">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(78,222,163,0.14),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(4,180,162,0.12),transparent_32%)]" />
      <div className="relative w-full max-w-sm">{children}</div>
    </main>
  );
}

function LoginForm() {
  return (
    <form className="space-y-4">
      <Field id="identifier" label="Email or Phone" placeholder="Enter your credentials" type="text" />
      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-on-surface-variant" htmlFor="password">Password</label>
        <div className="relative">
          <input id="password" className="w-full rounded-lg border border-outline-variant bg-surface-dim px-4 py-3 outline-none transition focus:border-secondary-container" placeholder="••••••••" type="password" />
          <button className="absolute inset-y-0 right-3 text-on-surface-variant" type="button">
            <Icon name="visibility_off" className="text-[20px]" />
          </button>
        </div>
        <div className="mt-2 text-right"><a className="text-sm text-primary" href="#">Forgot Password?</a></div>
      </div>
      <button className="w-full rounded-lg bg-primary-container py-3 font-semibold text-on-background transition hover:bg-primary" type="button">
        Sign In
      </button>
      <p className="rounded border border-outline-variant bg-surface-container p-3 text-xs leading-5 text-on-surface-variant">
        Live accounts are not active yet. Existing preview users can sign in once access is enabled.
      </p>
    </form>
  );
}

function SignupForm({ onJoin }: { onJoin: () => void }) {
  return (
    <form className="space-y-4">
      <Field id="name" label="Full Name" placeholder="Your legal name" type="text" />
      <Field id="signup-contact" label="Email or Phone" placeholder="Where should we notify you?" type="text" />
      <Field id="country" label="Country" placeholder="Country of residence" type="text" />
      <button className="w-full rounded-lg bg-primary-container py-3 font-semibold text-on-background transition hover:bg-primary" onClick={onJoin} type="button">
        Join Waitlist
      </button>
      <p className="rounded border border-primary/25 bg-primary/10 p-3 text-xs leading-5 text-on-surface-variant">
        Nezeem is currently in launch preparation. Creating an account reserves your place; we will notify you when deposits, betting, P2P, and trading features are available.
      </p>
    </form>
  );
}

function Field({ id, label, placeholder, type }: { id: string; label: string; placeholder: string; type: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-on-surface-variant" htmlFor={id}>{label}</label>
      <input id={id} className="w-full rounded-lg border border-outline-variant bg-surface-dim px-4 py-3 outline-none transition focus:border-secondary-container" placeholder={placeholder} type={type} />
    </div>
  );
}
