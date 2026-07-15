"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";
import { ACTIVE_LOCAL_COINS, localCoinIconUrl } from "@/lib/p2p/local-coins";

/**
 * Owner-admin top-up for in-app local coins (UG Coin, TZ Coin, …).
 *
 * These coins are 1:1-pegged marketing instruments with no deposit rail, so a
 * balance can only ever come from a grant. That previously meant hand-written
 * seed migrations keyed on email/is_admin — which run exactly once and no-op
 * silently when they match nothing (see 20260715120000, which did). This is the
 * supported path: idempotent to re-run, audited, and verifiable on the spot.
 *
 * KES is excluded — it aliases the fiat wallet (User.walletBalance) rather than
 * the crypto escrow rails, and POST /api/admin/p2p/grant-coin rejects it.
 */

interface GrantResult {
  username:  string;
  crypto:    string;
  network:   string;
  granted:   number;
  available: number;
  locked:    number;
}

const GRANTABLE = ACTIVE_LOCAL_COINS.filter((c) => c.currency !== "KES");

export function AdminV2GrantCoin() {
  const [crypto, setCrypto]     = useState(GRANTABLE[0]?.currency ?? "UGX");
  const [amount, setAmount]     = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]     = useState<GrantResult | null>(null);

  const coin      = GRANTABLE.find((c) => c.currency === crypto);
  const iconUrl   = localCoinIconUrl(crypto);
  const amountNum = Number(amount);
  const canSubmit = !submitting && Number.isFinite(amountNum) && amountNum > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/p2p/grant-coin", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          crypto,
          amount: amountNum,
          // Omitted → the API credits the calling admin's own account.
          ...(username.trim() ? { username: username.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Grant failed");
        return;
      }
      setResult(data as GrantResult);
      setAmount("");
      toast.success(
        `Granted ${amountNum.toLocaleString()} ${data.crypto}`,
        `${data.username} now holds ${Number(data.available).toLocaleString()} ${data.crypto}.`,
      );
    } catch {
      toast.error("Network error — grant not applied.");
    } finally {
      setSubmitting(false);
    }
  }

  const field = "w-full rounded-lg border border-[#3f3f46] bg-[#0e0e0f] px-3.5 py-3 text-[15px] text-[#e5e2e3] outline-none transition-colors placeholder:text-[#8c909f] focus:border-[#adc6ff]";
  const label = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ── Form ── */}
      <form onSubmit={submit} className="av2-card rounded-lg p-6">
        <div className="mb-6 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#adc6ff]/10">
            <Icon name="toll" size={20} className="text-[#adc6ff]" />
          </div>
          <div>
            <h3 className="text-[18px] font-semibold text-[#e5e2e3]">Grant in-app coin</h3>
            <p className="mt-0.5 text-[13px] text-[#c2c6d6]">
              Credits a 1:1-pegged local coin directly into a user&apos;s P2P wallet.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Coin */}
          <div>
            <label htmlFor="gc-coin" className={label}>Coin</label>
            <div className="relative">
              {iconUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={iconUrl} alt="" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full object-cover" />
              )}
              <select
                id="gc-coin"
                value={crypto}
                onChange={(e) => setCrypto(e.target.value)}
                className={`${field} appearance-none ${iconUrl ? "pl-10" : ""} pr-9`}
              >
                {GRANTABLE.map((c) => (
                  <option key={c.currency} value={c.currency}>{c.name} — {c.region}</option>
                ))}
              </select>
              <Icon name="expand_more" size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8c909f]" />
            </div>
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="gc-amount" className={label}>Amount</label>
            <div className="relative">
              <input
                id="gc-amount"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000000"
                className={`${field} av2-mono pr-14`}
              />
              <span className="av2-mono pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[#8c909f]">
                {crypto}
              </span>
            </div>
          </div>
        </div>

        {/* Username */}
        <div className="mt-4">
          <label htmlFor="gc-user" className={label}>Recipient</label>
          <input
            id="gc-user"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Leave blank to credit yourself"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={field}
          />
          <p className="mt-1.5 text-[12px] text-[#8c909f]">
            Targeted by username, not email — an account&apos;s email can be NULL.
          </p>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#4d8eff] px-4 py-3 text-[15px] font-semibold text-[#0a0a0b] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Icon name={submitting ? "progress_activity" : "toll"} size={18} className={submitting ? "animate-spin" : ""} />
          {submitting
            ? "Granting…"
            : `Grant${amountNum > 0 ? ` ${amountNum.toLocaleString()} ${crypto}` : " coin"}`}
        </button>
      </form>

      {/* ── Side panel ── */}
      <div className="space-y-4">
        {result ? (
          <div className="av2-card rounded-lg p-5">
            <div className="flex items-center gap-2">
              <Icon name="check_circle" size={18} className="text-[#7ddba2]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7ddba2]">Granted</span>
            </div>
            <p className="av2-mono mt-3 text-[28px] font-semibold leading-none text-[#e5e2e3]">
              {Number(result.available).toLocaleString()}
            </p>
            <p className="mt-1 text-[13px] text-[#c2c6d6]">
              {result.crypto} available to <span className="text-[#e5e2e3]">{result.username}</span>
            </p>
            <dl className="mt-4 space-y-2 border-t border-[#27272a] pt-4 text-[13px]">
              {[
                ["Granted now", `${Number(result.granted).toLocaleString()} ${result.crypto}`],
                ["Locked", `${Number(result.locked).toLocaleString()} ${result.crypto}`],
                ["Network", result.network],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-[#8c909f]">{k}</dt>
                  <dd className="av2-mono text-[#e5e2e3]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <div className="av2-card rounded-lg p-5">
            <div className="flex items-center gap-2">
              <Icon name="info" size={18} className="text-[#adc6ff]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">
                {coin?.name ?? "Local coin"}
              </span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-[#c2c6d6]">
              Pegged 1:1 to the {coin?.region ?? "local"} currency and traded over the P2P escrow
              rails. It has no blockchain deposit or withdrawal — a grant is the only way a balance
              is created.
            </p>
          </div>
        )}

        <div className="av2-card rounded-lg p-5">
          <div className="flex items-center gap-2">
            <Icon name="warning" size={18} className="text-[#ffb786]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#ffb786]">Adds, never sets</span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[#c2c6d6]">
            A grant increments the existing balance — running it twice grants twice. Check the
            recipient&apos;s balance before re-running.
          </p>
        </div>
      </div>
    </div>
  );
}
