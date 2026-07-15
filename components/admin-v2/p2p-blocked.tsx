"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";

/**
 * Owner-admin control for the per-user P2P kill switch
 * (system_settings.p2p_blocked_users — see lib/p2p/user-guard.ts).
 *
 * A blocked account cannot place orders, run express trades, post ads, or
 * fund/cash-out merchant escrow. Before this existed the flag had no UI, so
 * flipping it meant a deploy-time data migration that runs once and silently.
 */

interface Entry {
  email:    string;
  username: string | null;
  exists:   boolean;
}

export function AdminV2P2PBlocked() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail]     = useState("");
  const [busy, setBusy]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/p2p/blocked-users");
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function mutate(target: string, action: "block" | "unblock") {
    setBusy(`${action}:${target}`);
    try {
      const res = await fetch("/api/admin/p2p/blocked-users", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: target, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not update the block list");
        return;
      }
      setEntries(data.entries ?? []);
      if (action === "block") {
        setEmail("");
        toast.success("P2P blocked", `${target} can no longer trade.`);
      } else {
        toast.success("P2P restored", `${target} can trade again.`);
      }
    } catch {
      toast.error("Network error — nothing changed.");
    } finally {
      setBusy(null);
    }
  }

  const trimmed  = email.trim().toLowerCase();
  const already  = entries.some((e) => e.email === trimmed);
  const canBlock = !busy && trimmed.length > 0 && !already;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ── List + add ── */}
      <div className="av2-card rounded-lg p-6">
        <div className="mb-6 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#ffb786]/10">
            <Icon name="block" size={20} className="text-[#ffb786]" />
          </div>
          <div>
            <h3 className="text-[18px] font-semibold text-[#e5e2e3]">P2P access</h3>
            <p className="mt-0.5 text-[13px] text-[#c2c6d6]">
              Blocked accounts cannot place orders, trade express, post ads, or move escrow.
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (canBlock) mutate(trimmed, "block"); }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="account@example.com"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full flex-1 rounded-lg border border-[#3f3f46] bg-[#0e0e0f] px-3.5 py-3 text-[15px] text-[#e5e2e3] outline-none transition-colors placeholder:text-[#8c909f] focus:border-[#adc6ff]"
          />
          <button
            type="submit"
            disabled={!canBlock}
            className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#ffb786] px-5 py-3 text-[15px] font-semibold text-[#0a0a0b] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Icon name="block" size={18} />
            Block
          </button>
        </form>
        {already && (
          <p className="mt-2 text-[12px] text-[#ffb786]">That account is already blocked.</p>
        )}

        {/* List */}
        <div className="mt-6 border-t border-[#27272a] pt-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">
            Blocked accounts {!loading && `(${entries.length})`}
          </p>

          {loading ? (
            <div className="flex justify-center py-10">
              <Icon name="progress_activity" size={22} className="animate-spin text-[#8c909f]" />
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#3f3f46] px-4 py-10 text-center">
              <Icon name="check_circle" size={24} className="text-[#7ddba2]" />
              <p className="mt-2 text-[13px] text-[#c2c6d6]">Nobody is blocked — P2P is open to all accounts.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {entries.map((e) => (
                <li
                  key={e.email}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#27272a] bg-[#0e0e0f] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] text-[#e5e2e3]">{e.email}</p>
                    <p className="mt-0.5 text-[12px] text-[#8c909f]">
                      {e.exists
                        ? <>@{e.username ?? "—"}</>
                        : <span className="text-[#ffb786]">No account with this email</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => mutate(e.email, "unblock")}
                    disabled={busy === `unblock:${e.email}`}
                    className="shrink-0 rounded-lg border border-[#4d8eff]/30 bg-[#4d8eff]/10 px-3 py-1.5 text-[12px] font-semibold text-[#adc6ff] transition-colors hover:bg-[#4d8eff]/20 disabled:opacity-40"
                  >
                    {busy === `unblock:${e.email}` ? "Restoring…" : "Unblock"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Context ── */}
      <div className="space-y-4">
        <div className="av2-card rounded-lg p-5">
          <div className="flex items-center gap-2">
            <Icon name="schedule" size={18} className="text-[#adc6ff]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Up to 10s to apply</span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[#c2c6d6]">
            The block list is cached per server process for 10 seconds. A change lands immediately on
            the process that served it, and everywhere else within 10 seconds.
          </p>
        </div>

        <div className="av2-card rounded-lg p-5">
          <div className="flex items-center gap-2">
            <Icon name="alternate_email" size={18} className="text-[#ffb786]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#ffb786]">Matched by email</span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[#c2c6d6]">
            Entries key on the account&apos;s email, which can be NULL — an account whose email is
            owned by another auth identity cannot be blocked this way. Entries matching no account
            are flagged above.
          </p>
        </div>
      </div>
    </div>
  );
}
