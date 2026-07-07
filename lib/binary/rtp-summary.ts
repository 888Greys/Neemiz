/**
 * Periodic HEALTH SUMMARY for the binary/directional product. Unlike the
 * rtp-guard (which only pages on a breach), this always reports: it aggregates
 * realized RTP over a window across directional (Rise/Fall, Higher/Lower,
 * Touch/No Touch) and digit contracts, then sends a single Telegram digest
 * saying whether the house is healthy or which kind is drifting.
 *
 * Run from cron with `Authorization: Bearer $CRON_SECRET`, e.g. every 6h.
 * Admin/test accounts are excluded so owner stress-testing can't skew it.
 */
import { db } from "@/lib/db";
import { getExcludedUserIds } from "@/lib/admin-excluded";
import { sendTelegram } from "@/lib/telegram";

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

type Agg = { count: number; staked: number; paid: number };
const add = (m: Map<string, Agg>, key: string, stake: number, paid: number) => {
  const a = m.get(key) ?? { count: 0, staked: 0, paid: 0 };
  a.count++; a.staked += stake; a.paid += paid; m.set(key, a);
};
const rtpOf = (a: Agg) => (a.staked > 0 ? a.paid / a.staked : 0);

export type SummaryRow = { label: string; count: number; staked: number; rtp: number };
export type Summary = {
  windowH: number;
  healthy: boolean;
  overall: SummaryRow;
  rows: SummaryRow[];
  warnRtp: number;
};

/** Pure: turn per-kind aggregates into a health verdict. Healthy = overall RTP
 *  at/under the warn line AND no individual kind over it with a real sample. */
export function buildSummary(
  byKind: Map<string, Agg>, overall: Agg, windowH: number, warnRtp: number, minSample: number,
): Summary {
  const rows: SummaryRow[] = [...byKind.entries()]
    .map(([label, a]) => ({ label, count: a.count, staked: Math.round(a.staked), rtp: rtpOf(a) }))
    .sort((a, b) => b.staked - a.staked);
  const kindBreach = rows.some((r) => r.count >= minSample && r.rtp > warnRtp);
  const healthy = rtpOf(overall) <= warnRtp && !kindBreach;
  return {
    windowH, healthy, warnRtp,
    overall: { label: "ALL", count: overall.count, staked: Math.round(overall.staked), rtp: rtpOf(overall) },
    rows,
  };
}

export function formatSummary(s: Summary): string {
  const pct = (r: number) => `${(r * 100).toFixed(0)}%`;
  const head = s.healthy
    ? `✅ <b>Neemiz binary — healthy</b> (last ${s.windowH}h)`
    : `⚠️ <b>Neemiz binary — watch</b> (last ${s.windowH}h)`;
  const o = s.overall;
  const pnl = Math.round(o.staked - o.staked * o.rtp);
  const lines = [
    head,
    `Overall RTP <b>${pct(o.rtp)}</b> · house ${pnl >= 0 ? "+" : ""}KSh ${pnl.toLocaleString()} · ${o.count} bets · KSh ${o.staked.toLocaleString()} staked`,
    "",
  ];
  for (const r of s.rows) {
    const flag = r.count >= 1 && r.rtp > s.warnRtp ? " ⚠️" : "";
    lines.push(`• ${r.label}: ${pct(r.rtp)} (${r.count} bets)${flag}`);
  }
  if (!s.rows.length) lines.push("<i>no settled trades in window</i>");
  return lines.join("\n");
}

export async function runRtpSummary() {
  const windowH   = num(process.env.RTP_SUMMARY_WINDOW_HOURS, 6);
  const warnRtp   = num(process.env.RTP_SUMMARY_WARN_RTP, 1.05);
  const minSample = num(process.env.RTP_SUMMARY_MIN_SAMPLE, 100);
  const since = new Date(Date.now() - windowH * 60 * 60_000);
  const excluded = new Set(await getExcludedUserIds());

  const [directional, digits] = await Promise.all([
    db.directionalTrade.findMany({
      where: { status: { in: ["WON", "LOST"] }, settledAt: { gte: since } },
      select: { kind: true, stake: true, payout: true, status: true, userId: true },
    }),
    db.binaryTrade.findMany({
      where: { status: { in: ["WON", "LOST"] }, settledAt: { gte: since } },
      select: { side: true, stake: true, payout: true, status: true, userId: true },
    }),
  ]);

  const byKind = new Map<string, Agg>();
  const overall: Agg = { count: 0, staked: 0, paid: 0 };
  for (const t of directional) {
    if (excluded.has(t.userId)) continue;
    const stake = Number(t.stake);
    const paid = t.status === "WON" ? Number(t.payout) : 0;
    add(byKind, t.kind, stake, paid);
    overall.count++; overall.staked += stake; overall.paid += paid;
  }
  for (const t of digits) {
    if (excluded.has(t.userId)) continue;
    const stake = Number(t.stake);
    const paid = t.status === "WON" ? Number(t.payout) : 0;
    add(byKind, `Digit:${t.side}`, stake, paid);
    overall.count++; overall.staked += stake; overall.paid += paid;
  }

  const summary = buildSummary(byKind, overall, windowH, warnRtp, minSample);
  await sendTelegram(formatSummary(summary));
  return { healthy: summary.healthy, overallRtp: summary.overall.rtp, bets: summary.overall.count };
}
