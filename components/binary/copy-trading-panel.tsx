"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { useCurrency } from "@/lib/currency-context";

type LeaderRow = {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  imageUrl: string | null;
  followers: number;
  sample: {
    trades: number;
    winRate: number | null;
    pnlKes: number;
    volumeKes: number;
    windowDays?: number;
  };
};

type FollowRow = {
  id: string;
  leaderId: string;
  leaderUsername: string;
  leaderStatus: string;
  stakeMode: "FIXED" | "PERCENT_OF_LEADER";
  fixedStakeKes: number;
  percent: number;
  maxStakeKes: number;
  maxDailyLossKes: number;
  paused: boolean;
};

const DISCLOSURE_FOLLOW =
  "Past results do not guarantee future results. Copied trades debit your wallet. Params match the leader — your fill price can differ slightly.";

const DISCLOSURE_LEAD =
  "Followers mirror your Even/Odd and Rise/Fall trades (5+ ticks). You are not a licensed advisor; this is not investment advice.";

function initials(name: string) {
  const t = name.replace(/^@/, "").trim();
  return (t.slice(0, 2) || "?").toUpperCase();
}

function LeaderAvatar({
  username,
  imageUrl,
  size = 44,
}: {
  username: string;
  imageUrl?: string | null;
  size?: number;
}) {
  const cls = "shrink-0 rounded-full object-cover ring-1 ring-white/[0.08]";
  if (imageUrl) {
    return (
      // Google avatars often require no-referrer.
      <img
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className={cls}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500/30 to-sky-500/20 font-black text-white ring-1 ring-white/[0.08] ${
        size >= 48 ? "text-[13px]" : "text-[12px]"
      }`}
      style={{ width: size, height: size }}
    >
      {initials(username)}
    </span>
  );
}

function Field({
  label, children,
}: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl bg-[#0c0e14] px-3.5 py-2.5 text-[14px] font-semibold text-white outline-none ring-1 ring-white/[0.08] transition focus:ring-emerald-500/40";

export function CopyTradingPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { format, toKes, currency: cc } = useCurrency();
  const [enabled, setEnabled] = useState(true);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [follows, setFollows] = useState<FollowRow[]>([]);
  const [leaderProfile, setLeaderProfile] = useState<{ id: string; status: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"leaders" | "following" | "lead">("leaders");
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [picked, setPicked] = useState<LeaderRow | null>(null);
  const [acceptFollow, setAcceptFollow] = useState(false);
  const [stakeMode, setStakeMode] = useState<"FIXED" | "PERCENT_OF_LEADER">("FIXED");
  const [fixedUsd, setFixedUsd] = useState(1);
  const [percent, setPercent] = useState(100);
  const [maxUsd, setMaxUsd] = useState(10);
  const [maxLossUsd, setMaxLossUsd] = useState(50);
  const [acceptLead, setAcceptLead] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [L, F] = await Promise.all([
        fetch("/api/copy/leaders").then((r) => r.json()),
        fetch("/api/copy/follow").then((r) => r.json()),
      ]);
      setEnabled(L.enabled !== false);
      setLeaders(L.leaders ?? []);
      if (!F.error) {
        setFollows(F.follows ?? []);
        setLeaderProfile(F.leaderProfile ?? null);
      }
    } catch {
      setErr("Could not load copy trading.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setClosing(false);
      void reload();
    }
  }, [open, reload]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      onClose();
      closeTimer.current = null;
    }, 220);
  }, [closing, onClose]);

  async function followLeader() {
    if (!picked || !acceptFollow) return;
    setErr(null);
    const res = await fetch("/api/copy/follow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        leaderProfileId: picked.id,
        stakeMode,
        fixedStakeKes: toKes(fixedUsd),
        percent,
        maxStakeKes: toKes(maxUsd),
        maxDailyLossKes: toKes(maxLossUsd),
        acceptDisclosure: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Follow failed");
      return;
    }
    setPicked(null);
    setAcceptFollow(false);
    setTab("following");
    void reload();
  }

  async function patchFollow(followId: string, body: { paused?: boolean; unfollow?: boolean }) {
    setErr(null);
    const res = await fetch("/api/copy/follow", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ followId, ...body }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Update failed");
      return;
    }
    void reload();
  }

  async function becomeLeader() {
    if (!acceptLead) return;
    setErr(null);
    const res = await fetch("/api/copy/leaders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ acceptDisclosure: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Could not opt in");
      return;
    }
    setAcceptLead(false);
    void reload();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Copy trading"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={requestClose}
        className={`absolute inset-0 bg-black/60 ${closing ? "animate-sheet-backdrop-out" : "animate-sheet-backdrop-in"}`}
      />
      <div
        className={`relative flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#12151c] shadow-2xl ring-1 ring-white/[0.08] sm:rounded-2xl ${
          closing ? "animate-sheet-out" : "animate-sheet-in"
        }`}
      >
        <button
          type="button"
          onClick={requestClose}
          className="flex w-full justify-center pt-2.5 pb-1 sm:hidden"
          aria-label="Close sheet"
        >
          <span className="h-1 w-10 rounded-full bg-white/20" />
        </button>

        <div className="flex items-start gap-3 border-b border-white/[0.07] px-4 pb-3 pt-1 sm:pt-4">
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/25">
            <Icon name="groups" className="text-[20px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-black tracking-tight text-white">Copy trading</h2>
            <p className="mt-0.5 text-[11px] font-medium leading-snug text-slate-400">
              Mirror Even/Odd &amp; Rise/Fall from leaders you trust
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        {!enabled && (
          <div className="mx-4 mt-3 rounded-xl bg-amber-500/10 px-3 py-2.5 text-[12px] font-medium text-amber-200 ring-1 ring-amber-400/20">
            Copy trading is temporarily off.
          </div>
        )}

        <div className="mx-4 mt-3 grid grid-cols-3 gap-1 rounded-xl bg-[#0c0e14] p-1 ring-1 ring-white/[0.06]">
          {([
            ["leaders", "Leaders"],
            ["following", "Following"],
            ["lead", "Lead"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => { setTab(k); setPicked(null); }}
              className={`rounded-lg py-2 text-[12px] font-black transition ${
                tab === k
                  ? "bg-white/[0.08] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          {err && (
            <p className="mb-3 rounded-xl bg-rose-500/10 px-3 py-2 text-[12px] font-medium text-rose-300 ring-1 ring-rose-400/20">
              {err}
            </p>
          )}
          {loading && (
            <p className="py-8 text-center text-[12px] font-medium text-slate-500">Loading…</p>
          )}

          {tab === "leaders" && !picked && !loading && (
            <ul className="space-y-2.5">
              {leaders.length === 0 && (
                <li className="flex flex-col items-start gap-3 rounded-2xl bg-[#0c0e14] px-4 py-8 ring-1 ring-white/[0.06]">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.04] text-slate-500 ring-1 ring-white/[0.06]">
                    <Icon name="groups" className="text-[22px]" />
                  </span>
                  <div>
                    <p className="text-[14px] font-bold text-slate-200">No public leaders yet</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                      Opt in under Lead, or check back once others go public.
                    </p>
                  </div>
                </li>
              )}
              {leaders.map((L) => {
                const wr = L.sample.winRate == null ? null : Math.round(L.sample.winRate * 100);
                return (
                  <li
                    key={L.id}
                    className="rounded-2xl bg-[#0c0e14] p-3.5 ring-1 ring-white/[0.06] transition hover:ring-white/[0.1]"
                  >
                    <div className="flex items-start gap-3">
                      <LeaderAvatar username={L.username} imageUrl={L.imageUrl} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-black text-white">@{L.username}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-slate-400 ring-1 ring-white/[0.06]">
                            {L.sample.trades} copyable
                            {L.sample.windowDays ? ` · ${L.sample.windowDays}d` : ""}
                          </span>
                          <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-slate-400 ring-1 ring-white/[0.06]">
                            {wr == null ? "—" : `${wr}% win`}
                          </span>
                          <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-slate-400 ring-1 ring-white/[0.06]">
                            {L.followers} followers
                          </span>
                        </div>
                        {L.sample.trades === 0 ? (
                          <p className="mt-2 text-[10px] font-medium text-amber-400/90">
                            No Even/Odd or Rise/Fall in the sample window
                          </p>
                        ) : L.sample.trades < 10 ? (
                          <p className="mt-2 text-[10px] font-medium text-amber-400/90">
                            Low sample — treat stats lightly
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={!enabled}
                        onClick={() => { setPicked(L); setAcceptFollow(false); }}
                        className="shrink-0 rounded-full bg-emerald-600 px-3.5 py-2 text-[11px] font-black text-white transition hover:bg-emerald-500 active:scale-[0.97] disabled:opacity-40"
                      >
                        Follow
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {tab === "leaders" && picked && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="inline-flex items-center gap-1 text-[12px] font-bold text-slate-400 transition hover:text-white"
              >
                <Icon name="arrow_back" className="text-[16px]" />
                Back to leaders
              </button>

              <div className="flex items-center gap-3 rounded-2xl bg-[#0c0e14] p-3.5 ring-1 ring-white/[0.06]">
                <LeaderAvatar username={picked.username} imageUrl={picked.imageUrl} size={48} />
                <div>
                  <p className="text-[15px] font-black text-white">@{picked.username}</p>
                  <p className="text-[11px] text-slate-500">Set stake limits before you start</p>
                </div>
              </div>

              <p className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-slate-400 ring-1 ring-white/[0.05]">
                {DISCLOSURE_FOLLOW}
              </p>

              <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#0c0e14] p-1 ring-1 ring-white/[0.06]">
                {([
                  ["FIXED", "Fixed stake"],
                  ["PERCENT_OF_LEADER", "% of leader"],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setStakeMode(mode)}
                    className={`rounded-lg py-2 text-[11px] font-black transition ${
                      stakeMode === mode
                        ? "bg-emerald-600 text-white"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {stakeMode === "FIXED" ? (
                <Field label={`Fixed stake (${cc.code})`}>
                  <input
                    type="number"
                    min={1}
                    value={fixedUsd}
                    onChange={(e) => setFixedUsd(Number(e.target.value) || 1)}
                    className={inputCls}
                  />
                </Field>
              ) : (
                <Field label="Percent of leader stake">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={percent}
                    onChange={(e) => setPercent(Number(e.target.value) || 100)}
                    className={inputCls}
                  />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <Field label={`Max stake (${cc.code})`}>
                  <input
                    type="number"
                    min={1}
                    value={maxUsd}
                    onChange={(e) => setMaxUsd(Number(e.target.value) || 1)}
                    className={inputCls}
                  />
                </Field>
                <Field label={`Max daily loss (${cc.code})`}>
                  <input
                    type="number"
                    min={1}
                    value={maxLossUsd}
                    onChange={(e) => setMaxLossUsd(Number(e.target.value) || 1)}
                    className={inputCls}
                  />
                </Field>
              </div>

              <label className="flex items-start gap-2.5 rounded-xl bg-[#0c0e14] px-3 py-3 text-[12px] font-medium text-slate-300 ring-1 ring-white/[0.06]">
                <input
                  type="checkbox"
                  checked={acceptFollow}
                  onChange={(e) => setAcceptFollow(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent text-emerald-500"
                />
                I understand the risk disclosure
              </label>

              <button
                type="button"
                disabled={!acceptFollow}
                onClick={() => void followLeader()}
                className="w-full rounded-full bg-emerald-600 py-3 text-[14px] font-black text-white transition hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Start copying
              </button>
            </div>
          )}

          {tab === "following" && !loading && (
            <ul className="space-y-2.5">
              {follows.length === 0 && (
                <li className="flex flex-col items-start gap-3 rounded-2xl bg-[#0c0e14] px-4 py-8 ring-1 ring-white/[0.06]">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.04] text-slate-500 ring-1 ring-white/[0.06]">
                    <Icon name="swap_vert" className="text-[22px]" />
                  </span>
                  <div>
                    <p className="text-[14px] font-bold text-slate-200">Not following anyone</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                      Browse Leaders and tap Follow to start mirroring.
                    </p>
                  </div>
                </li>
              )}
              {follows.map((f) => (
                <li key={f.id} className="rounded-2xl bg-[#0c0e14] p-3.5 ring-1 ring-white/[0.06]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[14px] font-black text-white">@{f.leaderUsername}</p>
                      <p className="mt-1 text-[11px] leading-snug text-slate-500">
                        {f.stakeMode === "PERCENT_OF_LEADER"
                          ? `${f.percent}% of leader`
                          : `Stake ${format(f.fixedStakeKes)}`}
                        {" · "}max {format(f.maxStakeKes)}
                        {" · "}loss cap {format(f.maxDailyLossKes)}
                      </p>
                      {f.paused && (
                        <span className="mt-2 inline-block rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                          Paused
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void patchFollow(f.id, { paused: !f.paused })}
                      className="flex-1 rounded-full bg-white/[0.06] py-2 text-[11px] font-black text-white ring-1 ring-white/[0.08] transition hover:bg-white/[0.1]"
                    >
                      {f.paused ? "Resume" : "Pause"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void patchFollow(f.id, { unfollow: true })}
                      className="flex-1 rounded-full py-2 text-[11px] font-black text-rose-300 ring-1 ring-rose-400/25 transition hover:bg-rose-500/10"
                    >
                      Unfollow
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {tab === "lead" && !loading && (
            <div className="space-y-4">
              {leaderProfile?.status === "ACTIVE" ? (
                <div className="rounded-2xl bg-emerald-500/10 p-4 ring-1 ring-emerald-400/25">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <Icon name="check_circle" className="text-[20px]" />
                    <p className="text-[14px] font-black">You&apos;re an active leader</p>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-emerald-100/70">
                    Followers mirror your Even/Odd and Rise/Fall trades (5+ ticks).
                  </p>
                </div>
              ) : leaderProfile?.status === "SUSPENDED" ? (
                <div className="rounded-2xl bg-rose-500/10 p-4 text-[13px] font-medium text-rose-300 ring-1 ring-rose-400/25">
                  Your leader profile is suspended.
                </div>
              ) : (
                <>
                  <div className="rounded-2xl bg-[#0c0e14] p-4 ring-1 ring-white/[0.06]">
                    <p className="text-[13px] font-black text-white">Become a leader</p>
                    <p className="mt-2 text-[12px] leading-relaxed text-slate-400">{DISCLOSURE_LEAD}</p>
                  </div>
                  <label className="flex items-start gap-2.5 rounded-xl bg-[#0c0e14] px-3 py-3 text-[12px] font-medium text-slate-300 ring-1 ring-white/[0.06]">
                    <input
                      type="checkbox"
                      checked={acceptLead}
                      onChange={(e) => setAcceptLead(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent text-violet-500"
                    />
                    I accept and want to become a leader
                  </label>
                  <button
                    type="button"
                    disabled={!acceptLead || !enabled}
                    onClick={() => void becomeLeader()}
                    className="w-full rounded-full bg-violet-600 py-3 text-[14px] font-black text-white transition hover:bg-violet-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Opt in as leader
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
