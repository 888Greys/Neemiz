import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { isCopyTradingEnabled, MVP_COPYABLE_FAMILIES } from "@/lib/copy-trading";

export const dynamic = "force-dynamic";

/** Public list of ACTIVE copy leaders with trailing 7d sample stats. */
export async function GET() {
  if (!(await isCopyTradingEnabled())) {
    return Response.json({ leaders: [], enabled: false });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const leaders = await db.copyLeaderProfile.findMany({
    where: { status: "ACTIVE", isPublic: true },
    include: {
      user: { select: { id: true, username: true, isAdmin: true } },
      _count: { select: { follows: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  // Prod: hide admin/house leaders from the public book. Staging sets
  // COPY_SHOW_ADMIN_LEADERS=true so owners can dogfood copy end-to-end.
  const hideAdminLeaders = process.env.COPY_SHOW_ADMIN_LEADERS !== "true";

  const out = [];
  for (const L of leaders) {
    if (hideAdminLeaders && L.user.isAdmin) continue;
    const [digit, dir] = await Promise.all([
      db.binaryTrade.findMany({
        where: {
          userId: L.userId,
          createdAt: { gte: since },
          status: { in: ["WON", "LOST"] },
          side: { in: ["Even", "Odd"] },
          autoSessionId: null,
        },
        select: { status: true, stake: true, payout: true },
        take: 500,
      }),
      db.directionalTrade.findMany({
        where: {
          userId: L.userId,
          createdAt: { gte: since },
          status: { in: ["WON", "LOST"] },
          kind: "RISE_FALL",
        },
        select: { status: true, stake: true, payout: true },
        take: 500,
      }),
    ]);
    const trades = [...digit, ...dir];
    let wins = 0;
    let stakeSum = 0;
    let pnl = 0;
    for (const t of trades) {
      const stake = Number(t.stake);
      stakeSum += stake;
      if (t.status === "WON") {
        wins += 1;
        pnl += Number(t.payout) - stake;
      } else {
        pnl -= stake;
      }
    }
    const n = trades.length;
    out.push({
      id: L.id,
      userId: L.userId,
      username: L.user.username ?? L.displayName ?? "trader",
      displayName: L.displayName,
      bio: L.bio,
      allowedFamilies: L.allowedFamilies.split(",").map((s) => s.trim()).filter(Boolean),
      followers: L._count.follows,
      sample: {
        trades: n,
        winRate: n ? wins / n : null,
        pnlKes: Math.round(pnl),
        volumeKes: Math.round(stakeSum),
      },
    });
  }

  // Prefer leaders with enough sample; still show thin samples at the end.
  out.sort((a, b) => (b.sample.trades - a.sample.trades) || (b.sample.pnlKes - a.sample.pnlKes));

  return Response.json({
    leaders: out,
    enabled: true,
    mvpFamilies: [...MVP_COPYABLE_FAMILIES],
  });
}

/** Leader opt-in (creates PENDING→ACTIVE profile; admins blocked). */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isCopyTradingEnabled())) {
    return Response.json({ error: "Copy trading is temporarily off." }, { status: 503 });
  }

  let body: { displayName?: string; bio?: string; acceptDisclosure?: boolean } = {};
  try { body = await req.json(); } catch { /* empty ok */ }
  if (!body.acceptDisclosure) {
    return Response.json({
      error: "Confirm: followers will mirror your trades; you are not a licensed advisor.",
    }, { status: 400 });
  }

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  if (dbUser.isAdmin) {
    return Response.json({ error: "Admin accounts cannot be copy leaders." }, { status: 403 });
  }

  const profile = await db.copyLeaderProfile.upsert({
    where: { userId: dbUser.id },
    create: {
      userId: dbUser.id,
      displayName: body.displayName?.slice(0, 40) || dbUser.username || null,
      bio: body.bio?.slice(0, 280) || null,
      isPublic: true,
      allowedFamilies: MVP_COPYABLE_FAMILIES.join(","),
      status: "ACTIVE",
    },
    update: {
      displayName: body.displayName?.slice(0, 40) || undefined,
      bio: body.bio?.slice(0, 280) || undefined,
      status: "ACTIVE",
      isPublic: true,
    },
  });

  return Response.json({
    profile: {
      id: profile.id,
      status: profile.status,
      displayName: profile.displayName,
      allowedFamilies: profile.allowedFamilies,
    },
  }, { status: 201 });
}
