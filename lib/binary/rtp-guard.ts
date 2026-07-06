/**
 * Runtime RTP guard for the LIVE binary product. The pricing engine proves each
 * contract is house-safe in expectation, but this is the net for reality: it
 * measures REALIZED return-to-player from settled trades and, if a contract kind
 * bleeds beyond a threshold over meaningful volume, AUTO-HALTS that kind (adds it
 * to disabled_bet_types) and pages the owner. It also flags individual users
 * whose realized RTP is implausibly high over volume (possible exploiter) — those
 * are alerted, not auto-frozen, so a human decides.
 *
 * Run from cron with `Authorization: Bearer $CRON_SECRET`, every ~5–10 min.
 * Admin/test accounts are excluded so owner stress-testing can't trip the guard.
 */
import { db } from "@/lib/db";
import { disableBetType } from "@/lib/game-guard";
import { getExcludedUserIds } from "@/lib/admin-excluded";
import { sendRtpGuardAlertEmail } from "@/lib/brevo";

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export type Agg = { count: number; staked: number; paid: number };

/** Pure: does this aggregate breach the house-loss threshold over enough volume? */
export function evaluateKind(a: Agg, minSample: number, haltRtp: number): { rtp: number; breach: boolean } {
  const rtp = a.staked > 0 ? a.paid / a.staked : 0;
  return { rtp, breach: a.count >= minSample && rtp > haltRtp };
}

const KINDS = ["RISE_FALL", "HIGHER_LOWER", "TOUCH_NO_TOUCH", "VANILLA"] as const;

export async function runRtpGuard() {
  const windowH   = num(process.env.RTP_WINDOW_HOURS, 12);
  const kindMin   = num(process.env.RTP_HALT_MIN_SAMPLE, 200);
  const haltRtp   = num(process.env.RTP_HALT_THRESHOLD, 1.10);
  const userMin   = num(process.env.RTP_USER_MIN_SAMPLE, 50);
  const userRtp   = num(process.env.RTP_USER_ALERT_THRESHOLD, 1.30);
  const cooldownH = num(process.env.RTP_ALERT_COOLDOWN_HOURS, 6);
  const since = new Date(Date.now() - windowH * 60 * 60_000);
  const cooldownSince = new Date(Date.now() - cooldownH * 60 * 60_000);

  const excluded = new Set(await getExcludedUserIds());
  const trades = await db.directionalTrade.findMany({
    where: { status: { in: ["WON", "LOST"] }, settledAt: { gte: since } },
    select: { kind: true, side: true, stake: true, payout: true, status: true, userId: true },
  });

  const byKind = new Map<string, Agg>();
  const byUser = new Map<string, Agg>();
  for (const t of trades) {
    if (excluded.has(t.userId)) continue;
    const stake = Number(t.stake);
    const paid = t.status === "WON" ? Number(t.payout) : 0;
    const k = byKind.get(t.kind) ?? { count: 0, staked: 0, paid: 0 };
    k.count++; k.staked += stake; k.paid += paid; byKind.set(t.kind, k);
    const u = byUser.get(t.userId) ?? { count: 0, staked: 0, paid: 0 };
    u.count++; u.staked += stake; u.paid += paid; byUser.set(t.userId, u);
  }

  const admins = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  const notify = async (type: string, title: string, body: string, link: string) => {
    const recent = await db.notification.findFirst({ where: { type, createdAt: { gte: cooldownSince } }, select: { id: true } });
    if (recent) return false;
    if (admins.length) {
      await db.notification.createMany({ data: admins.map((a) => ({ userId: a.id, type, title, body, link })) });
    }
    return true;
  };

  const halted: { kind: string; rtp: number }[] = [];
  const userFlags: { userId: string; rtp: number; count: number }[] = [];

  // Per-kind: auto-halt on breach.
  for (const kind of KINDS) {
    const agg = byKind.get(kind);
    if (!agg) continue;
    const { rtp, breach } = evaluateKind(agg, kindMin, haltRtp);
    if (!breach) continue;
    await disableBetType("directional", kind);           // pull it offline now
    halted.push({ kind, rtp });
    await notify(
      `rtp_halt:${kind}`,
      `🚨 Binary ${kind} auto-halted — RTP ${(rtp * 100).toFixed(0)}%`,
      `${kind} paid out ${(rtp * 100).toFixed(0)}% of stake over ${agg.count} trades (>${(haltRtp * 100).toFixed(0)}%). It has been disabled automatically. Investigate before re-enabling.`,
      "/admin/risk",
    );
  }

  // Per-user: alert only (human decides on a freeze).
  for (const [userId, agg] of byUser) {
    if (agg.count < userMin) continue;
    const rtp = agg.staked > 0 ? agg.paid / agg.staked : 0;
    if (rtp <= userRtp) continue;
    userFlags.push({ userId, rtp, count: agg.count });
    const u = await db.user.findUnique({ where: { id: userId }, select: { username: true } });
    await notify(
      `rtp_user:${userId}`,
      `⚠️ High player RTP — ${u?.username ?? userId.slice(0, 8)} at ${(rtp * 100).toFixed(0)}%`,
      `${u?.username ?? userId} realized ${(rtp * 100).toFixed(0)}% RTP over ${agg.count} binary trades. Possible exploit — review and freeze if warranted.`,
      "/admin/players",
    );
  }

  if (halted.length || userFlags.length) {
    try { await sendRtpGuardAlertEmail({ halted, userFlags, windowH }); }
    catch (e) { console.error("[rtp-guard] owner email failed", e); }
  }

  return { kindsChecked: byKind.size, halted: halted.map((h) => h.kind), usersFlagged: userFlags.length };
}
