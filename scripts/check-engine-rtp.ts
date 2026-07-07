import { db } from "@/lib/db";
import { getExcludedUserIds } from "@/lib/admin-excluded";

async function main() {
  console.log("Analyzing Directional Trades from Database...");
  
  // Fetch all settled directional trades
  const trades = await db.directionalTrade.findMany({
    where: { status: { in: ["WON", "LOST"] } },
    select: {
      id: true,
      kind: true,
      side: true,
      stake: true,
      payout: true,
      status: true,
      userId: true,
      createdAt: true,
      settledAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Total settled directional trades found: ${trades.length}`);
  if (trades.length === 0) {
    console.log("No settled directional trades found in the database.");
    return;
  }

  // Load excluded/test user IDs
  let excludedUserIds: string[] = [];
  try {
    excludedUserIds = await getExcludedUserIds();
  } catch (e) {
    console.log("Could not load excluded users (fallback to empty list):", e instanceof Error ? e.message : e);
  }
  const excludedSet = new Set(excludedUserIds);

  let totalStaked = 0;
  let totalPaid = 0;
  let totalCount = 0;

  const byKind = new Map<string, { count: number; staked: number; paid: number }>();
  const byUser = new Map<string, { count: number; staked: number; paid: number; username?: string }>();

  for (const t of trades) {
    // Check if user is excluded (admin/test)
    if (excludedSet.has(t.userId)) continue;

    const stake = Number(t.stake);
    const paid = t.status === "WON" ? Number(t.payout) : 0;

    totalCount++;
    totalStaked += stake;
    totalPaid += paid;

    // Aggregate by Kind
    const k = byKind.get(t.kind) ?? { count: 0, staked: 0, paid: 0 };
    k.count++;
    k.staked += stake;
    k.paid += paid;
    byKind.set(t.kind, k);

    // Aggregate by User
    const u = byUser.get(t.userId) ?? { count: 0, staked: 0, paid: 0 };
    u.count++;
    u.staked += stake;
    u.paid += paid;
    byUser.set(t.userId, u);
  }

  // Populate usernames
  const userIds = Array.from(byUser.keys());
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, email: true },
  });
  for (const user of users) {
    const u = byUser.get(user.id);
    if (u) {
      u.username = user.username ?? user.email ?? user.id;
    }
  }

  console.log("\n=================================");
  console.log("OVERALL STATS (Excluding Admins)");
  console.log("=================================");
  const overallRtp = totalStaked > 0 ? (totalPaid / totalStaked) * 100 : 0;
  console.log(`Total Settled Trades: ${totalCount}`);
  console.log(`Total Staked:         KSh ${totalStaked.toFixed(2)}`);
  console.log(`Total Paid Out:       KSh ${totalPaid.toFixed(2)}`);
  console.log(`Realized RTP:         ${overallRtp.toFixed(2)}% (House Edge: ${(100 - overallRtp).toFixed(2)}%)`);

  console.log("\n=================================");
  console.log("STATS BY CONTRACT KIND");
  console.log("=================================");
  console.log(
    "Kind".padEnd(20) +
    " | " + "Count".padStart(8) +
    " | " + "Staked".padStart(12) +
    " | " + "Payout".padStart(12) +
    " | " + "RTP".padStart(8) +
    " | " + "Status"
  );
  console.log("-".repeat(75));
  
  for (const [kind, data] of byKind.entries()) {
    const rtp = data.staked > 0 ? (data.paid / data.staked) * 100 : 0;
    const isBreached = data.count >= 200 && rtp > 110;
    const status = isBreached ? "🚨 EXPLOIT BREACH (>110% RTP)" : "✅ SAFE";
    console.log(
      kind.padEnd(20) +
      " | " + data.count.toString().padStart(8) +
      " | " + `KSh ${data.staked.toFixed(0)}`.padStart(12) +
      " | " + `KSh ${data.paid.toFixed(0)}`.padStart(12) +
      " | " + `${rtp.toFixed(1)}%`.padStart(8) +
      " | " + status
    );
  }

  console.log("\n=================================");
  console.log("TOP USERS BY STAKED AMOUNT");
  console.log("=================================");
  console.log(
    "Username/Email".padEnd(30) +
    " | " + "Count".padStart(8) +
    " | " + "Staked".padStart(12) +
    " | " + "Payout".padStart(12) +
    " | " + "RTP".padStart(8) +
    " | " + "Status"
  );
  console.log("-".repeat(85));

  const sortedUsers = Array.from(byUser.entries())
    .sort((a, b) => b[1].staked - a[1].staked)
    .slice(0, 15);

  for (const [userId, data] of sortedUsers) {
    const rtp = data.staked > 0 ? (data.paid / data.staked) * 100 : 0;
    const isExploiter = data.count >= 50 && rtp > 115;
    const status = isExploiter ? "⚠️ HIGH RTP (>115%)" : "✅ NORMAL";
    const displayName = data.username ?? userId;
    console.log(
      displayName.padEnd(30) +
      " | " + data.count.toString().padStart(8) +
      " | " + `KSh ${data.staked.toFixed(0)}`.padStart(12) +
      " | " + `KSh ${data.paid.toFixed(0)}`.padStart(12) +
      " | " + `${rtp.toFixed(1)}%`.padStart(8) +
      " | " + status
    );
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
