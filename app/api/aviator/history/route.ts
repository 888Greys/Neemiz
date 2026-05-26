import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// Returns the authenticated user's Aviator bet history reconstructed
// from wallet transactions (the Go service doesn't expose round history yet).
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json([]);

    const dbUser = await getOrCreateUser(user.id, { email: user.email });

    // Fetch stake transactions, newest first
    const stakes = await db.transaction.findMany({
      where: {
        userId: dbUser.id,
        type: "BET_STAKE",
        provider: "aviator-service",
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    if (stakes.length === 0) return Response.json([]);

    // Fetch matching win transactions
    const wins = await db.transaction.findMany({
      where: {
        userId: dbUser.id,
        type: "BET_WIN",
        provider: "aviator-service",
      },
      orderBy: { createdAt: "asc" },
    });

    // Match each stake to its closest subsequent win on the same panelIndex
    const result = stakes.map((stake, i) => {
      const meta = stake.metadata as Record<string, unknown> | null;
      const panelIndex = (meta?.panelIndex as number) ?? 0;
      const stakeTime = stake.createdAt.getTime();

      const win = wins.find((w) => {
        const wm = w.metadata as Record<string, unknown> | null;
        return (
          w.createdAt.getTime() > stakeTime &&
          w.createdAt.getTime() < stakeTime + 180_000 &&
          (wm?.panelIndex as number | undefined) === panelIndex
        );
      });

      const multiplier = win
        ? ((win.metadata as Record<string, unknown> | null)?.multiplier as number | undefined) ?? null
        : null;

      return {
        id: stake.id,
        panelIndex,
        betAmount: Number(stake.amount),
        cashoutAt: multiplier,
        winAmount: win ? Number(win.amount) : null,
        status: win ? "CASHEDOUT" : "LOST",
        placedAt: stake.createdAt.toISOString(),
        // Go service doesn't expose round history yet; use sequential index
        roundNumber: stakes.length - i,
        crashPoint: 0,
      };
    });

    return Response.json(result, {
      headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
    });
  } catch (err) {
    console.error("GET /api/aviator/history:", err instanceof Error ? err.message : err);
    return Response.json([]);
  }
}
