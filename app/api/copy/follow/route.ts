import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { isCopyTradingEnabled } from "@/lib/copy-trading";
import { minPlayStakeKes, maxPlayStakeKes, FALLBACK_USD_KES } from "@/lib/play-usd";

export const dynamic = "force-dynamic";

/** List my active follows + my leader profile (if any). */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const [follows, leaderProfile] = await Promise.all([
    db.copyFollow.findMany({
      where: { followerId: dbUser.id },
      include: {
        leader: { select: { id: true, username: true } },
        leaderProfile: { select: { id: true, displayName: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.copyLeaderProfile.findUnique({ where: { userId: dbUser.id } }),
  ]);

  return Response.json({
    enabled: await isCopyTradingEnabled(),
    follows: follows.map((f) => ({
      id: f.id,
      leaderId: f.leaderId,
      leaderUsername: f.leader.username ?? f.leaderProfile.displayName ?? "trader",
      leaderStatus: f.leaderProfile.status,
      stakeMode: f.stakeMode,
      fixedStakeKes: Number(f.fixedStakeKes),
      percent: Number(f.percent),
      maxStakeKes: Number(f.maxStakeKes),
      maxDailyLossKes: Number(f.maxDailyLossKes),
      paused: f.paused,
    })),
    leaderProfile: leaderProfile
      ? {
          id: leaderProfile.id,
          status: leaderProfile.status,
          displayName: leaderProfile.displayName,
          allowedFamilies: leaderProfile.allowedFamilies,
        }
      : null,
  });
}

/**
 * Follow a leader. MVP: one active (non-paused) leader per follower — pausing
 * others when starting a new follow.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isCopyTradingEnabled())) {
    return Response.json({ error: "Copy trading is temporarily off." }, { status: 503 });
  }

  let body: {
    leaderProfileId?: string;
    stakeMode?: "FIXED" | "PERCENT_OF_LEADER";
    fixedStakeKes?: number;
    percent?: number;
    maxStakeKes?: number;
    maxDailyLossKes?: number;
    acceptDisclosure?: boolean;
  };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  if (!body.acceptDisclosure) {
    return Response.json({
      error: "Confirm: past results ≠ future results; you can lose your stake.",
    }, { status: 400 });
  }
  if (!body.leaderProfileId) {
    return Response.json({ error: "leaderProfileId required" }, { status: 400 });
  }

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const profile = await db.copyLeaderProfile.findUnique({
    where: { id: body.leaderProfileId },
    include: { user: { select: { id: true, isAdmin: true } } },
  });
  if (!profile || profile.status !== "ACTIVE" || !profile.isPublic) {
    return Response.json({ error: "Leader not available." }, { status: 404 });
  }
  if (profile.user.isAdmin) {
    return Response.json({ error: "Cannot follow this leader." }, { status: 403 });
  }
  if (profile.userId === dbUser.id) {
    return Response.json({ error: "You cannot follow yourself." }, { status: 400 });
  }

  // Anti-snake: block if this leader already follows the would-be follower.
  const reverse = await db.copyFollow.findUnique({
    where: { followerId_leaderId: { followerId: profile.userId, leaderId: dbUser.id } },
  });
  if (reverse && !reverse.paused) {
    return Response.json({ error: "Mutual copy follows are not allowed." }, { status: 400 });
  }

  const minStake = await minPlayStakeKes();
  const maxPlatform = await maxPlayStakeKes();
  const stakeMode = body.stakeMode === "PERCENT_OF_LEADER" ? "PERCENT_OF_LEADER" : "FIXED";
  const fixedStakeKes = Math.max(minStake, Math.min(maxPlatform, Math.round(Number(body.fixedStakeKes) || FALLBACK_USD_KES)));
  const percent = Math.max(1, Math.min(500, Number(body.percent) || 100));
  const maxStakeKes = Math.max(minStake, Math.min(maxPlatform, Math.round(Number(body.maxStakeKes) || fixedStakeKes)));
  const maxDailyLossKes = Math.max(minStake, Math.round(Number(body.maxDailyLossKes) || maxStakeKes * 10));

  // One active leader: pause other follows.
  await db.copyFollow.updateMany({
    where: { followerId: dbUser.id, paused: false, NOT: { leaderId: profile.userId } },
    data: { paused: true },
  });

  const follow = await db.copyFollow.upsert({
    where: { followerId_leaderId: { followerId: dbUser.id, leaderId: profile.userId } },
    create: {
      followerId: dbUser.id,
      leaderId: profile.userId,
      leaderProfileId: profile.id,
      stakeMode,
      fixedStakeKes,
      percent,
      maxStakeKes,
      maxDailyLossKes,
      paused: false,
    },
    update: {
      leaderProfileId: profile.id,
      stakeMode,
      fixedStakeKes,
      percent,
      maxStakeKes,
      maxDailyLossKes,
      paused: false,
    },
  });

  return Response.json({
    follow: {
      id: follow.id,
      leaderId: follow.leaderId,
      stakeMode: follow.stakeMode,
      fixedStakeKes: Number(follow.fixedStakeKes),
      percent: Number(follow.percent),
      maxStakeKes: Number(follow.maxStakeKes),
      maxDailyLossKes: Number(follow.maxDailyLossKes),
      paused: follow.paused,
    },
  }, { status: 201 });
}

/** Pause / resume / unfollow. */
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  let body: { followId?: string; paused?: boolean; unfollow?: boolean };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }
  if (!body.followId) return Response.json({ error: "followId required" }, { status: 400 });

  const follow = await db.copyFollow.findFirst({
    where: { id: body.followId, followerId: dbUser.id },
  });
  if (!follow) return Response.json({ error: "Not found" }, { status: 404 });

  if (body.unfollow) {
    await db.copyFollow.delete({ where: { id: follow.id } });
    return Response.json({ ok: true, unfollowed: true });
  }

  if (typeof body.paused === "boolean") {
    if (!body.paused) {
      await db.copyFollow.updateMany({
        where: { followerId: dbUser.id, paused: false, NOT: { id: follow.id } },
        data: { paused: true },
      });
    }
    const updated = await db.copyFollow.update({
      where: { id: follow.id },
      data: { paused: body.paused },
    });
    return Response.json({ ok: true, paused: updated.paused });
  }

  return Response.json({ error: "Nothing to update" }, { status: 400 });
}
