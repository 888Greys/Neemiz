"use client";

import { useCallback, useEffect, useState } from "react";
import { useCurrency } from "@/lib/currency-context";

type LeaderRow = {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  followers: number;
  sample: { trades: number; winRate: number | null; pnlKes: number; volumeKes: number };
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
  "Past results do not guarantee future results. Copied trades use your balance and you can lose your stake. Same contract params — your fill may differ slightly.";

const DISCLOSURE_LEAD =
  "Followers will mirror your Even/Odd and Rise/Fall trades (5+ ticks). You are not a licensed advisor; this is not investment advice.";

export function CopyTradingPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { format, toKes } = useCurrency();
  const [enabled, setEnabled] = useState(true);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [follows, setFollows] = useState<FollowRow[]>([]);
  const [leaderProfile, setLeaderProfile] = useState<{ id: string; status: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"leaders" | "following" | "lead">("leaders");

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
    if (open) void reload();
  }, [open, reload]);

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-[#12151c] ring-1 ring-white/10 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="text-[15px] font-black text-white">Copy trading</h2>
            <p className="text-[11px] text-slate-400">Mirror Even/Odd &amp; Rise/Fall from opt-in leaders</p>
          </div>
          <button type="button" onClick={onClose} className="text-[12px] font-bold text-slate-400 hover:text-white">
            Close
          </button>
        </div>

        {!enabled && (
          <p className="px-4 py-3 text-[12px] text-amber-300">Copy trading is temporarily off.</p>
        )}

        <div className="flex gap-1 border-b border-white/10 px-2 pt-2">
          {([
            ["leaders", "Leaders"],
            ["following", "Following"],
            ["lead", "Lead"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`flex-1 rounded-t-md px-2 py-2 text-[12px] font-bold ${
                tab === k ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {err && <p className="mb-2 text-[12px] text-rose-300">{err}</p>}
          {loading && <p className="text-[12px] text-slate-500">Loading…</p>}

          {tab === "leaders" && !picked && (
            <ul className="space-y-2">
              {leaders.length === 0 && !loading && (
                <p className="text-[12px] text-slate-500">No public leaders yet.</p>
              )}
              {leaders.map((L) => (
                <li key={L.id} className="rounded-lg bg-[#0f1319] p-3 ring-1 ring-white/[0.06]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-black text-white">@{L.username}</p>
                      <p className="text-[11px] text-slate-500">
                        {L.sample.trades} trades ·{" "}
                        {L.sample.winRate == null ? "—" : `${Math.round(L.sample.winRate * 100)}% win`} ·{" "}
                        {L.followers} followers
                      </p>
                      {L.sample.trades < 10 && (
                        <p className="text-[10px] text-amber-400/80">Low sample — treat stats lightly</p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!enabled}
                      onClick={() => { setPicked(L); setAcceptFollow(false); }}
                      className="rounded-md bg-[#3a414d] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#4a5160] disabled:opacity-40"
                    >
                      Follow
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {tab === "leaders" && picked && (
            <div className="space-y-3">
              <button type="button" onClick={() => setPicked(null)} className="text-[11px] font-bold text-slate-400">
                ← Back
              </button>
              <p className="text-[14px] font-black text-white">Follow @{picked.username}</p>
              <p className="text-[11px] leading-relaxed text-slate-400">{DISCLOSURE_FOLLOW}</p>
              <div className="flex gap-1">
                {([
                  ["FIXED", "Fixed stake"],
                  ["PERCENT_OF_LEADER", "% of leader"],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setStakeMode(mode)}
                    className={`flex-1 rounded-md py-1.5 text-[11px] font-bold ${
                      stakeMode === mode ? "bg-[#3a414d] text-white" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {stakeMode === "FIXED" ? (
                <label className="block text-[11px] font-bold text-slate-300">
                  Fixed stake ($)
                  <input
                    type="number"
                    min={1}
                    value={fixedUsd}
                    onChange={(e) => setFixedUsd(Number(e.target.value) || 1)}
                    className="mt-1 w-full rounded-md bg-[#0f1319] px-3 py-2 text-white ring-1 ring-white/10 outline-none"
                  />
                </label>
              ) : (
                <label className="block text-[11px] font-bold text-slate-300">
                  Percent of leader stake
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={percent}
                    onChange={(e) => setPercent(Number(e.target.value) || 100)}
                    className="mt-1 w-full rounded-md bg-[#0f1319] px-3 py-2 text-white ring-1 ring-white/10 outline-none"
                  />
                </label>
              )}
              <label className="block text-[11px] font-bold text-slate-300">
                Max stake ($)
                <input
                  type="number"
                  min={1}
                  value={maxUsd}
                  onChange={(e) => setMaxUsd(Number(e.target.value) || 1)}
                  className="mt-1 w-full rounded-md bg-[#0f1319] px-3 py-2 text-white ring-1 ring-white/10 outline-none"
                />
              </label>
              <label className="block text-[11px] font-bold text-slate-300">
                Max daily loss ($)
                <input
                  type="number"
                  min={1}
                  value={maxLossUsd}
                  onChange={(e) => setMaxLossUsd(Number(e.target.value) || 1)}
                  className="mt-1 w-full rounded-md bg-[#0f1319] px-3 py-2 text-white ring-1 ring-white/10 outline-none"
                />
              </label>
              <label className="flex items-start gap-2 text-[11px] text-slate-300">
                <input type="checkbox" checked={acceptFollow} onChange={(e) => setAcceptFollow(e.target.checked)} className="mt-0.5" />
                I understand the risk disclosure
              </label>
              <button
                type="button"
                disabled={!acceptFollow}
                onClick={() => void followLeader()}
                className="w-full rounded-lg bg-emerald-700 py-2.5 text-[13px] font-black text-white disabled:opacity-40"
              >
                Start copying
              </button>
            </div>
          )}

          {tab === "following" && (
            <ul className="space-y-2">
              {follows.length === 0 && !loading && (
                <p className="text-[12px] text-slate-500">You are not following anyone.</p>
              )}
              {follows.map((f) => (
                <li key={f.id} className="rounded-lg bg-[#0f1319] p-3 ring-1 ring-white/[0.06]">
                  <p className="text-[13px] font-black text-white">@{f.leaderUsername}</p>
                  <p className="text-[11px] text-slate-500">
                    {f.stakeMode === "PERCENT_OF_LEADER"
                      ? `${f.percent}% of leader`
                      : `Stake ${format(f.fixedStakeKes)}`}
                    {" · "}max {format(f.maxStakeKes)} · daily loss cap {format(f.maxDailyLossKes)}
                    {f.paused ? " · paused" : ""}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void patchFollow(f.id, { paused: !f.paused })}
                      className="rounded-md bg-[#3a414d] px-2.5 py-1 text-[11px] font-bold text-white"
                    >
                      {f.paused ? "Resume" : "Pause"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void patchFollow(f.id, { unfollow: true })}
                      className="rounded-md px-2.5 py-1 text-[11px] font-bold text-rose-300 ring-1 ring-rose-400/30"
                    >
                      Unfollow
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {tab === "lead" && (
            <div className="space-y-3">
              {leaderProfile?.status === "ACTIVE" ? (
                <p className="text-[13px] text-emerald-300">
                  You are an active copy leader. Followers mirror your Even/Odd and Rise/Fall (5+ ticks).
                </p>
              ) : leaderProfile?.status === "SUSPENDED" ? (
                <p className="text-[13px] text-rose-300">Your leader profile is suspended.</p>
              ) : (
                <>
                  <p className="text-[12px] leading-relaxed text-slate-400">{DISCLOSURE_LEAD}</p>
                  <label className="flex items-start gap-2 text-[11px] text-slate-300">
                    <input type="checkbox" checked={acceptLead} onChange={(e) => setAcceptLead(e.target.checked)} className="mt-0.5" />
                    I accept and want to become a leader
                  </label>
                  <button
                    type="button"
                    disabled={!acceptLead || !enabled}
                    onClick={() => void becomeLeader()}
                    className="w-full rounded-lg bg-[#3a414d] py-2.5 text-[13px] font-black text-white disabled:opacity-40"
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
