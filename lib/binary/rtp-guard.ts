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
import { sendTelegram, isTelegramConfigured } from "@/lib/telegram";

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

// Directional contract kinds live in `directionalTrade.kind`; digit contract
// sides live in `binaryTrade.side`. Both are exploitable and both auto-halt via
// their own game-guard namespace ("directional:<kind>" / "binary:<side>").
export const KINDS = ["RISE_FALL", "HIGHER_LOWER", "TOUCH_NO_TOUCH", "VANILLA"] as const;
export const DIGIT_SIDES = ["Even", "Odd", "Matches", "Differs", "Over", "Under"] as const;

/** Every contract the runtime RTP guard watches, namespaced by game. Exported so
 *  a test can assert the guard covers BOTH directional kinds AND digit sides —
 *  the digit sides were the blind spot that let Over/Under bleed unchecked.
 *  Accumulator uses token `accumulator:ALL` (single family kill). */
export function guardedContracts(): { game: string; key: string }[] {
  return [
    ...KINDS.map((k) => ({ game: "directional", key: k as string })),
    ...DIGIT_SIDES.map((s) => ({ game: "binary", key: s as string })),
    { game: "accumulator", key: "ALL" },
  ];
}

export async function runRtpGuard() {
  const windowH   = num(process.env.RTP_WINDOW_HOURS, 12);
  const kindMin   = num(process.env.RTP_HALT_MIN_SAMPLE, 200);
  const haltRtp   = num(process.env.RTP_HALT_THRESHOLD, 1.10);
  const userMin   = num(process.env.RTP_USER_MIN_SAMPLE, 50);
  const userRtp   = num(process.env.RTP_USER_ALERT_THRESHOLD, 1.15);
  const cooldownH = num(process.env.RTP_ALERT_COOLDOWN_HOURS, 6);
  const since = new Date(Date.now() - windowH * 60 * 60_000);
  const cooldownSince = new Date(Date.now() - cooldownH * 60 * 60_000);

  const excluded = new Set(await getExcludedUserIds());
  const [directional, digits, accas] = await Promise.all([
    db.directionalTrade.findMany({
      where: { status: { in: ["WON", "LOST"] }, settledAt: { gte: since } },
      select: { kind: true, stake: true, payout: true, status: true, userId: true },
    }),
    db.binaryTrade.findMany({
      where: { status: { in: ["WON", "LOST"] }, settledAt: { gte: since } },
      select: { side: true, stake: true, payout: true, status: true, userId: true },
    }),
    db.accumulatorTrade.findMany({
      where: { status: { in: ["CLOSED", "BUSTED"] }, settledAt: { gte: since } },
      select: { stake: true, payout: true, status: true, userId: true },
    }),
  ]);

  // Per-contract aggregates are namespaced by game so a directional kind and a
  // digit side can never collide. Per-user aggregates span BOTH products, so a
  // user farming Over/Under is flagged just like a directional exploiter.
  const byKind = new Map<string, Agg>();   // key: "directional:<kind>" | "binary:<side>" | "accumulator:ALL"
  const byUser = new Map<string, Agg>();
  const accumulate = (game: string, key: string, userId: string, stake: number, paid: number) => {
    if (excluded.has(userId)) return;
    const token = `${game}:${key}`;
    const k = byKind.get(token) ?? { count: 0, staked: 0, paid: 0 };
    k.count++; k.staked += stake; k.paid += paid; byKind.set(token, k);
    const u = byUser.get(userId) ?? { count: 0, staked: 0, paid: 0 };
    u.count++; u.staked += stake; u.paid += paid; byUser.set(userId, u);
  };
  for (const t of directional) {
    accumulate("directional", t.kind, t.userId, Number(t.stake), t.status === "WON" ? Number(t.payout) : 0);
  }
  for (const t of digits) {
    accumulate("binary", t.side, t.userId, Number(t.stake), t.status === "WON" ? Number(t.payout) : 0);
  }
  for (const t of accas) {
    accumulate("accumulator", "ALL", t.userId, Number(t.stake), t.status === "CLOSED" ? Number(t.payout) : 0);
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
  let sentAlert = false;   // did any notification clear the cooldown this run?

  // Per-contract: auto-halt on breach, across BOTH directional kinds and digit sides.
  for (const { game, key } of guardedContracts()) {
    const agg = byKind.get(`${game}:${key}`);
    if (!agg) continue;
    const { rtp, breach } = evaluateKind(agg, kindMin, haltRtp);
    if (!breach) continue;
    await disableBetType(game, key);                     // pull it offline now
    const label = game === "binary" ? `Digit ${key}` : game === "accumulator" ? "Accumulator" : key;
    halted.push({ kind: label, rtp });
    sentAlert = (await notify(
      `rtp_halt:${game}:${key}`,
      `🚨 Binary ${label} auto-halted — RTP ${(rtp * 100).toFixed(0)}%`,
      `${label} paid out ${(rtp * 100).toFixed(0)}% of stake over ${agg.count} trades (>${(haltRtp * 100).toFixed(0)}%). It has been disabled automatically. Investigate before re-enabling.`,
      "/admin/risk",
    )) || sentAlert;
  }

  // Per-user: alert only (human decides on a freeze).
  for (const [userId, agg] of byUser) {
    if (agg.count < userMin) continue;
    const rtp = agg.staked > 0 ? agg.paid / agg.staked : 0;
    if (rtp <= userRtp) continue;
    userFlags.push({ userId, rtp, count: agg.count });
    const u = await db.user.findUnique({ where: { id: userId }, select: { username: true } });
    sentAlert = (await notify(
      `rtp_user:${userId}`,
      `⚠️ High player RTP — ${u?.username ?? userId.slice(0, 8)} at ${(rtp * 100).toFixed(0)}%`,
      `${u?.username ?? userId} realized ${(rtp * 100).toFixed(0)}% RTP over ${agg.count} binary trades. Possible exploit — review and freeze if warranted.`,
      "/admin/players",
    )) || sentAlert;
  }

  if (halted.length || userFlags.length) {
    // Email only as a fallback when Telegram isn't configured — the owner's
    // primary channel is Telegram (below), so don't double-notify by email.
    if (!isTelegramConfigured()) {
      try { await sendRtpGuardAlertEmail({ halted, userFlags, windowH }); }
      catch (e) { console.error("[rtp-guard] owner email failed", e); }
    }

    // Immediate Telegram page. Only fires when the cooldown let a notification
    // through above (so we don't re-page every 10 min for the same breach).
    if (sentAlert) {
      const lines: string[] = [`🚨 <b>Neemiz RTP guard</b> — last ${windowH}h`];
      for (const h of halted) lines.push(`• <b>${h.kind}</b> AUTO-HALTED at ${(h.rtp * 100).toFixed(0)}% RTP`);
      for (const f of userFlags) lines.push(`• ⚠️ player <code>${f.userId.slice(0, 8)}</code> at ${(f.rtp * 100).toFixed(0)}% over ${f.count} trades`);
      try { await sendTelegram(lines.join("\n")); }
      catch (e) { console.error("[rtp-guard] telegram failed", e); }
    }
  }

  return { kindsChecked: byKind.size, halted: halted.map((h) => h.kind), usersFlagged: userFlags.length };
}
