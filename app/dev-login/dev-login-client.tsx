"use client";

import { useState } from "react";

type DevAccountInfo = { key: string; email: string; password: string; username: string };

export function DevLoginClient({ accounts }: { accounts: DevAccountInfo[] }) {
  const [email, setEmail] = useState(accounts[0]?.email ?? "");
  const [password, setPassword] = useState(accounts[0]?.password ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(body: object) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/dev-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Login failed");
        return;
      }
      // Full navigation so the server picks up the cookie + auth-context refetches.
      window.location.href = "key" in body && body.key === "owner" ? "/admin" : "/dashboard";
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#151518] p-4 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f1218] p-6">
        <div className="mb-1 text-lg font-black">Dev Login</div>
        <div className="mb-5 text-xs font-bold text-amber-400">Local development only — not present in production.</div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {accounts.map((a) => (
            <button
              key={a.key}
              type="button"
              disabled={loading}
              onClick={() => login({ key: a.key })}
              className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-black transition hover:bg-sky-400 disabled:opacity-50"
            >
              Login as {a.username}
            </button>
          ))}
        </div>

        <div className="my-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">or with email + password</div>

        <form
          onSubmit={(e) => { e.preventDefault(); void login({ email, password }); }}
          className="space-y-2"
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold outline-none focus:border-sky-400"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="password"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold outline-none focus:border-sky-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#0b8f62] px-3 py-2 text-sm font-black transition hover:bg-[#0da26f] disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {error && <div className="mt-3 text-xs font-bold text-red-400">{error}</div>}

        <div className="mt-5 text-[11px] font-bold text-slate-500">
          Seeded credentials:
          <ul className="mt-1 space-y-0.5">
            {accounts.map((a) => (
              <li key={a.key} className="font-mono text-slate-400">{a.email} / {a.password}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
