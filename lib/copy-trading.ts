/**
 * Binary copy trading — opt-in leader → follower mirrors.
 *
 * Not a signals marketplace. Leaders opt in; followers subscribe with stake
 * caps. When a leader places an eligible trade we enqueue a CopySignal; the
 * cron (and optional inline kick) fans out re-priced copies fail-closed.
 */

import { db } from "@/lib/db";
import { spendForPlay } from "@/lib/balance";
import { TransactionStatus, TransactionType, type CopyFollow, type CopySignal, type Prisma } from "@prisma/client";
import { getCalibrationTicks } from "@/lib/binary/calibration";
import { getLiveEntrySpot } from "@/lib/binary-price";
import { exitDigitFromQuote, type DigitSide } from "@/lib/binary/kernel";
import { priceDigitServer, priceDirectionalServer, resolveDigitEdgeFloor, type FixedKind } from "@/lib/binary/server-price";
import { buildDigitProof, buildProof, isProvablyFairConfigured, sha256 } from "@/lib/binary/provably-fair";
import { isBetTypeDisabled } from "@/lib/game-guard";
import { registerDue } from "@/lib/settle-due-list";
import { minPlayStakeKes, maxPlayStakeKes } from "@/lib/play-usd";
import type { DirectionalSide } from "@/lib/directional";

export const COPY_TRADING_FLAG = "copy_trading_enabled";
export const MIN_COPY_DURATION_TICKS = 5;
export const MVP_COPYABLE_FAMILIES = [
  "binary:Even",
  "binary:Odd",
  "directional:RISE_FALL",
] as const;

export type DigitCopyParams = {
  market: string;
  side: DigitSide;
  targetDigit: number;
  durationTicks: number;
};

export type DirectionalCopyParams = {
  market: string;
  kind: "RISE_FALL";
  side: DirectionalSide;
  durationTicks: number;
  barrierOffset: number;
};

const FLAG_TTL_MS = 10_000;
let flagCache: { enabled: boolean; expires: number } | null = null;

export async function isCopyTradingEnabled(): Promise<boolean> {
  if (flagCache && flagCache.expires > Date.now()) return flagCache.enabled;
  let enabled = true; // default on; ops can set flag to "false"
  try {
    const row = await db.systemSetting.findUnique({
      where: { key: COPY_TRADING_FLAG },
      select: { value: true },
    });
    if (row?.value != null) {
      const v = row.value.trim().toLowerCase();
      enabled = !(v === "false" || v === "0" || v === "off");
    }
  } catch {
    enabled = true;
  }
  flagCache = { enabled, expires: Date.now() + FLAG_TTL_MS };
  return enabled;
}

export function clearCopyTradingFlagCache() {
  flagCache = null;
}

export function parseAllowedFamilies(raw: string): Set<string> {
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

export function familyTokenForDigit(side: string): string {
  return `binary:${side}`;
}

export function familyTokenForDirectional(kind: string): string {
  return `directional:${kind}`;
}

export function isMvpCopyableFamily(token: string): boolean {
  return (MVP_COPYABLE_FAMILIES as readonly string[]).includes(token);
}

/**
 * Resolve leader usernames for follower trade IDs via CopyTradeLink.
 * Used by history / activity surfaces to show "Copied from @leader".
 */
export async function leaderUsernamesForFollowerTrades(
  followerTradeIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(followerTradeIds.filter(Boolean))];
  if (ids.length === 0) return out;

  const links = await db.copyTradeLink.findMany({
    where: { followerTradeId: { in: ids }, status: "COPIED" },
    select: {
      followerTradeId: true,
      signal: {
        select: {
          leader: { select: { username: true } },
          leaderProfile: { select: { displayName: true } },
        },
      },
    },
  });

  for (const link of links) {
    if (!link.followerTradeId) continue;
    const name =
      link.signal.leader.username
      || link.signal.leaderProfile.displayName
      || "leader";
    out.set(link.followerTradeId, name);
  }
  return out;
}

type StakeFollowInput = {
  stakeMode: CopyFollow["stakeMode"] | "FIXED" | "PERCENT_OF_LEADER";
  fixedStakeKes: number | { toString(): string };
  percent: number | { toString(): string };
  maxStakeKes: number | { toString(): string };
};

/** Compute follower stake from follow settings + leader stake. */
export function computeFollowerStakeKes(
  follow: StakeFollowInput,
  leaderStake: number,
  minStake: number,
  maxPlatformStake: number,
): number {
  const maxCap = Math.min(Number(follow.maxStakeKes), maxPlatformStake);
  let raw: number;
  if (follow.stakeMode === "PERCENT_OF_LEADER") {
    raw = Math.round((leaderStake * Number(follow.percent)) / 100);
  } else {
    raw = Math.round(Number(follow.fixedStakeKes));
  }
  return Math.max(minStake, Math.min(maxCap, raw));
}

/** Net P&L today for copied fills (for max daily loss). */
export async function followerCopyPnlTodayKes(followerId: string): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const links = await db.copyTradeLink.findMany({
    where: {
      followerId,
      status: "COPIED",
      createdAt: { gte: start },
      followerTradeId: { not: null },
    },
    select: { game: true, followerTradeId: true, stake: true },
  });
  let pnl = 0;
  for (const link of links) {
    if (!link.followerTradeId) continue;
    const stake = Number(link.stake ?? 0);
    if (link.game === "binary") {
      const t = await db.binaryTrade.findUnique({
        where: { id: link.followerTradeId },
        select: { status: true, stake: true, payout: true },
      });
      if (!t || t.status === "PENDING") continue;
      if (t.status === "WON") pnl += Number(t.payout) - Number(t.stake);
      else if (t.status === "LOST") pnl -= Number(t.stake);
      else if (t.status === "VOID") { /* refunded — ignore */ }
    } else {
      const t = await db.directionalTrade.findUnique({
        where: { id: link.followerTradeId },
        select: { status: true, stake: true, payout: true },
      });
      if (!t || t.status === "PENDING") continue;
      if (t.status === "WON") pnl += Number(t.payout) - Number(t.stake);
      else if (t.status === "LOST") pnl -= Number(t.stake);
    }
  }
  return pnl;
}

type EnqueueDigitArgs = {
  leaderUserId: string;
  tradeId: string;
  stake: number;
  params: DigitCopyParams;
};

type EnqueueDirArgs = {
  leaderUserId: string;
  tradeId: string;
  stake: number;
  params: DirectionalCopyParams;
};

/**
 * After a leader's manual place succeeds, enqueue a copy signal if they are an
 * active leader and the family is allowed. No-op otherwise. Never throws to
 * the bet path — copy must not break the leader's trade.
 */
export async function enqueueDigitCopySignal(args: EnqueueDigitArgs): Promise<string | null> {
  try {
    if (!(await isCopyTradingEnabled())) return null;
    if (args.params.durationTicks < MIN_COPY_DURATION_TICKS) return null;
    if (args.params.side !== "Even" && args.params.side !== "Odd") return null;
    const token = familyTokenForDigit(args.params.side);
    if (!isMvpCopyableFamily(token)) return null;

    const profile = await db.copyLeaderProfile.findUnique({
      where: { userId: args.leaderUserId },
    });
    if (!profile || profile.status !== "ACTIVE") return null;
    if (parseAllowedFamilies(profile.allowedFamilies).size > 0
        && !parseAllowedFamilies(profile.allowedFamilies).has(token)) {
      return null;
    }

    const signal = await db.copySignal.create({
      data: {
        leaderId: args.leaderUserId,
        leaderProfileId: profile.id,
        game: "binary",
        leaderTradeId: args.tradeId,
        familyToken: token,
        leaderStake: args.stake,
        params: args.params as unknown as Prisma.InputJsonValue,
        status: "PENDING",
      },
    });
    return signal.id;
  } catch (err) {
    console.error("enqueueDigitCopySignal:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function enqueueDirectionalCopySignal(args: EnqueueDirArgs): Promise<string | null> {
  try {
    if (!(await isCopyTradingEnabled())) return null;
    if (args.params.kind !== "RISE_FALL") return null;
    if (args.params.durationTicks < MIN_COPY_DURATION_TICKS) return null;
    const token = familyTokenForDirectional(args.params.kind);
    if (!isMvpCopyableFamily(token)) return null;

    const profile = await db.copyLeaderProfile.findUnique({
      where: { userId: args.leaderUserId },
    });
    if (!profile || profile.status !== "ACTIVE") return null;
    if (parseAllowedFamilies(profile.allowedFamilies).size > 0
        && !parseAllowedFamilies(profile.allowedFamilies).has(token)) {
      return null;
    }

    const signal = await db.copySignal.create({
      data: {
        leaderId: args.leaderUserId,
        leaderProfileId: profile.id,
        game: "directional",
        leaderTradeId: args.tradeId,
        familyToken: token,
        leaderStake: args.stake,
        params: args.params as unknown as Prisma.InputJsonValue,
        status: "PENDING",
      },
    });
    return signal.id;
  } catch (err) {
    console.error("enqueueDirectionalCopySignal:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function placeDigitCopyForFollower(opts: {
  followerId: string;
  stake: number;
  params: DigitCopyParams;
}): Promise<string> {
  const { followerId, stake, params } = opts;
  if (await isBetTypeDisabled("binary", params.side)) {
    throw new Error("FAMILY_DISABLED");
  }
  const [calib, entry] = await Promise.all([
    getCalibrationTicks(params.market),
    getLiveEntrySpot(params.market),
  ]);
  const entryDigit = exitDigitFromQuote(entry.spot);
  const edgeFloor = resolveDigitEdgeFloor(params.side, params.targetDigit, calib.edge);
  const priced = priceDigitServer({
    side: params.side,
    targetDigit: params.targetDigit,
    durationTicks: params.durationTicks,
    stake,
    ticks: calib.prices,
    edgeFloor,
    market: params.market,
    entryDigit,
  });
  if (!priced.accepted) throw new Error(`PRICE_REJECTED: ${priced.reason}`);

  const settleBefore = new Date(Date.now() + params.durationTicks * 3000 + 120_000);
  const clientSeed = sha256(`copy:${followerId}`);
  const proof = isProvablyFairConfigured()
    ? buildDigitProof({
        market: params.market,
        side: params.side,
        targetDigit: params.targetDigit,
        entryEpoch: entry.epoch,
        durationTicks: params.durationTicks,
        payoutMultiplier: priced.multiplier,
        clientSeed,
        nonce: Date.now(),
      })
    : null;

  const trade = await db.$transaction(async (tx) => {
    await spendForPlay(tx, followerId, stake);
    const created = await tx.binaryTrade.create({
      data: {
        userId: followerId,
        market: params.market,
        side: params.side,
        stake,
        payout: priced.payout,
        targetDigit: params.targetDigit,
        entryDigit,
        entryEpoch: entry.epoch,
        durationTicks: params.durationTicks,
        settleBefore,
        status: "PENDING",
        pfServerSeed: proof?.serverSeed,
        pfCommitment: proof?.commitment,
        pfSignature: proof?.signature,
        pfClientSeed: proof ? clientSeed : undefined,
        pfNonce: proof ? String(proof.terms.nonce) : undefined,
        pfPayoutMultiplier: proof ? priced.multiplier : undefined,
      },
    });
    await tx.transaction.create({
      data: {
        userId: followerId,
        type: TransactionType.BET_STAKE,
        amount: stake,
        currency: "KES",
        status: TransactionStatus.COMPLETED,
        reference: `binary-copy-stake-${followerId}-${created.id}`,
        provider: "binary",
        metadata: { game: "binary", copy: true, tradeId: created.id, market: params.market, side: params.side },
      },
    });
    return created;
  });

  registerDue({
    kind: "binary",
    tradeId: trade.id,
    userId: trade.userId,
    market: trade.market,
    entryEpoch: trade.entryEpoch!,
    durationTicks: trade.durationTicks,
    settleBeforeMs: trade.settleBefore.getTime(),
  });
  return trade.id;
}

async function placeRiseFallCopyForFollower(opts: {
  followerId: string;
  stake: number;
  params: DirectionalCopyParams;
}): Promise<string> {
  const { followerId, stake, params } = opts;
  if (await isBetTypeDisabled("directional", "RISE_FALL")) {
    throw new Error("FAMILY_DISABLED");
  }
  const [calib, entry] = await Promise.all([
    getCalibrationTicks(params.market),
    getLiveEntrySpot(params.market),
  ]);
  const priced = priceDirectionalServer({
    kind: "RISE_FALL" as FixedKind,
    side: params.side,
    entrySpot: entry.spot,
    barrier: null,
    durationTicks: params.durationTicks,
    stake,
    ticks: calib.prices,
    market: params.market,
    edgeFloor: calib.edge,
  });
  if (!priced.accepted) throw new Error(`PRICE_REJECTED: ${priced.reason}`);

  const settleBefore = new Date(Date.now() + params.durationTicks * 3000 + 120_000);
  const clientSeed = sha256(`copy-dir:${followerId}`);
  const proof = isProvablyFairConfigured()
    ? buildProof({
        market: params.market,
        kind: "RISE_FALL",
        side: params.side,
        entrySpot: entry.spot,
        entryEpoch: entry.epoch,
        barrier: null,
        durationTicks: params.durationTicks,
        payoutMultiplier: priced.multiplier,
        clientSeed,
        nonce: Date.now(),
      })
    : null;

  const trade = await db.$transaction(async (tx) => {
    await spendForPlay(tx, followerId, stake);
    const created = await tx.directionalTrade.create({
      data: {
        userId: followerId,
        market: params.market,
        kind: "RISE_FALL",
        side: params.side,
        stake,
        payout: priced.payout,
        entrySpot: entry.spot,
        entryEpoch: entry.epoch,
        barrier: null,
        durationTicks: params.durationTicks,
        settleBefore,
        status: "PENDING",
        pfServerSeed: proof?.serverSeed,
        pfCommitment: proof?.commitment,
        pfSignature: proof?.signature,
        pfClientSeed: proof ? clientSeed : undefined,
        pfNonce: proof ? String(proof.terms.nonce) : undefined,
        pfPayoutMultiplier: proof ? priced.multiplier : undefined,
      },
    });
    await tx.transaction.create({
      data: {
        userId: followerId,
        type: TransactionType.BET_STAKE,
        amount: stake,
        currency: "KES",
        status: TransactionStatus.COMPLETED,
        reference: `directional-copy-stake-${followerId}-${created.id}`,
        provider: "directional",
        metadata: { game: "directional", copy: true, tradeId: created.id, market: params.market, kind: "RISE_FALL", side: params.side },
      },
    });
    return created;
  });

  registerDue({
    kind: "directional",
    tradeId: trade.id,
    userId: trade.userId,
    market: trade.market,
    entryEpoch: trade.entryEpoch,
    durationTicks: trade.durationTicks,
    settleBeforeMs: trade.settleBefore.getTime(),
  });
  return trade.id;
}

async function processOneFollow(
  signal: CopySignal,
  follow: CopyFollow & { follower: { id: string; isAdmin: boolean; isActive: boolean } },
  minStake: number,
  maxPlatform: number,
): Promise<void> {
  const existing = await db.copyTradeLink.findUnique({
    where: { signalId_followId: { signalId: signal.id, followId: follow.id } },
  });
  if (existing) return;

  const skip = async (reason: string) => {
    await db.copyTradeLink.create({
      data: {
        signalId: signal.id,
        followId: follow.id,
        followerId: follow.followerId,
        game: signal.game,
        status: "SKIPPED",
        skipReason: reason,
      },
    });
  };

  if (follow.paused) return skip("paused");
  if (!follow.follower.isActive) return skip("follower_inactive");
  if (follow.followerId === signal.leaderId) return skip("self");

  // Anti-chain: follower must not themselves be an active leader being copied into a loop
  // (MVP: one active leader per follower already; also block if follower leads this leader).
  const reverse = await db.copyFollow.findUnique({
    where: { followerId_leaderId: { followerId: signal.leaderId, leaderId: follow.followerId } },
  });
  if (reverse && !reverse.paused) return skip("mutual_follow");

  const pnlToday = await followerCopyPnlTodayKes(follow.followerId);
  if (pnlToday <= -Number(follow.maxDailyLossKes)) return skip("daily_loss_cap");

  const stake = computeFollowerStakeKes(follow, Number(signal.leaderStake), minStake, maxPlatform);
  if (stake < minStake) return skip("stake_too_small");

  try {
    let tradeId: string;
    if (signal.game === "binary") {
      const params = signal.params as unknown as DigitCopyParams;
      tradeId = await placeDigitCopyForFollower({ followerId: follow.followerId, stake, params });
    } else {
      const params = signal.params as unknown as DirectionalCopyParams;
      tradeId = await placeRiseFallCopyForFollower({ followerId: follow.followerId, stake, params });
    }
    await db.copyTradeLink.create({
      data: {
        signalId: signal.id,
        followId: follow.id,
        followerId: follow.followerId,
        followerTradeId: tradeId,
        game: signal.game,
        stake,
        status: "COPIED",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg === "INSUFFICIENT_BALANCE") return skip("insufficient_balance");
    if (msg === "FAMILY_DISABLED") return skip("family_disabled");
    if (msg.startsWith("PRICE_REJECTED")) return skip(msg.slice(0, 120));
    await db.copyTradeLink.create({
      data: {
        signalId: signal.id,
        followId: follow.id,
        followerId: follow.followerId,
        game: signal.game,
        stake,
        status: "FAILED",
        skipReason: msg.slice(0, 160),
      },
    });
  }
}

/** Process a single PENDING signal → DONE. Idempotent. */
export async function processCopySignal(signalId: string): Promise<{ follows: number; copied: number; skipped: number }> {
  const claimed = await db.copySignal.updateMany({
    where: { id: signalId, status: "PENDING" },
    data: { status: "PROCESSING" },
  });
  if (claimed.count === 0) return { follows: 0, copied: 0, skipped: 0 };

  const signal = await db.copySignal.findUnique({ where: { id: signalId } });
  if (!signal) return { follows: 0, copied: 0, skipped: 0 };

  const follows = await db.copyFollow.findMany({
    where: { leaderId: signal.leaderId, paused: false },
    include: { follower: { select: { id: true, isAdmin: true, isActive: true } } },
  });

  const minStake = await minPlayStakeKes();
  const maxPlatform = await maxPlayStakeKes();
  let copied = 0;
  let skipped = 0;

  for (const follow of follows) {
    const before = await db.copyTradeLink.count({
      where: { signalId: signal.id, followId: follow.id },
    });
    await processOneFollow(signal, follow, minStake, maxPlatform);
    const link = await db.copyTradeLink.findUnique({
      where: { signalId_followId: { signalId: signal.id, followId: follow.id } },
    });
    if (link?.status === "COPIED") copied += 1;
    else if (link && before === 0) skipped += 1;
  }

  await db.copySignal.update({
    where: { id: signalId },
    data: { status: "DONE" },
  });

  return { follows: follows.length, copied, skipped };
}

/** Cron: drain PENDING signals oldest-first. */
export async function processPendingCopySignals(limit = 50): Promise<{
  processed: number;
  copied: number;
  skipped: number;
}> {
  if (!(await isCopyTradingEnabled())) {
    return { processed: 0, copied: 0, skipped: 0 };
  }
  const pending = await db.copySignal.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: Math.min(limit, 200),
    select: { id: true },
  });
  let copied = 0;
  let skipped = 0;
  for (const s of pending) {
    const r = await processCopySignal(s.id);
    copied += r.copied;
    skipped += r.skipped;
  }
  return { processed: pending.length, copied, skipped };
}

/** Fire-and-forget kick after enqueue (best-effort; cron is the safety net). */
export function kickCopySignal(signalId: string | null | undefined): void {
  if (!signalId) return;
  void processCopySignal(signalId).catch((err) => {
    console.error("kickCopySignal:", err instanceof Error ? err.message : err);
  });
}
