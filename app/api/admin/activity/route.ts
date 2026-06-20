import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/admin-2fa";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const dbUser = await db.user.findUnique({
    where: { supabaseId: user.id },
    select: { isAdmin: true },
  });
  if (!dbUser?.isAdmin) return false;

  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return Boolean(token && verifyAdminToken(token));
}

const userSelect = {
  id: true,
  email: true,
  username: true,
} as const;

// Allowed live windows (minutes) — plus 30 days as the long view.
const ALLOWED_MINUTES = [30, 60, 120, 240, 720, 1440, 43200];

export async function GET(req: Request) {
  if (!await requireAdmin()) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const requested = parseInt(new URL(req.url).searchParams.get("minutes") ?? "60", 10);
  const minutes = ALLOWED_MINUTES.includes(requested) ? requested : 60;
  const since = new Date(Date.now() - minutes * 60_000);

  const [
    sports,
    sportsPlayers,
    sportsRecent,
    predictions,
    predictionPlayers,
    predictionRecent,
    aviator,
    aviatorPlayers,
    aviatorRecent,
    binary,
    binaryPlayers,
    binaryRecent,
    forex,
    forexPlayers,
    forexRecent,
    p2p,
    p2pBuyers,
    p2pRecent,
  ] = await Promise.all([
    db.bet.aggregate({
      where: { createdAt: { gte: since } },
      _count: true,
      _sum: { stake: true, potentialWin: true, winAmount: true },
    }),
    db.bet.findMany({ where: { createdAt: { gte: since } }, distinct: ["userId"], select: { userId: true } }),
    db.bet.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, stake: true, status: true, createdAt: true, user: { select: userSelect } },
    }),
    db.polymarketBet.aggregate({
      where: { createdAt: { gte: since } },
      _count: true,
      _sum: { stake: true, potentialWin: true, winAmount: true },
    }),
    db.polymarketBet.findMany({ where: { createdAt: { gte: since } }, distinct: ["userId"], select: { userId: true } }),
    db.polymarketBet.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, question: true, outcome: true, stake: true, status: true, createdAt: true, user: { select: userSelect } },
    }),
    db.aviatorBet.aggregate({
      where: { placedAt: { gte: since } },
      _count: true,
      _sum: { betAmount: true, winAmount: true },
    }),
    db.aviatorBet.findMany({ where: { placedAt: { gte: since } }, distinct: ["userId"], select: { userId: true } }),
    db.aviatorBet.findMany({
      where: { placedAt: { gte: since } },
      orderBy: { placedAt: "desc" },
      take: 30,
      select: { id: true, betAmount: true, winAmount: true, status: true, placedAt: true, user: { select: userSelect } },
    }),
    db.binaryTrade.aggregate({
      where: { createdAt: { gte: since } },
      _count: true,
      _sum: { stake: true, payout: true },
    }),
    db.binaryTrade.findMany({ where: { createdAt: { gte: since } }, distinct: ["userId"], select: { userId: true } }),
    db.binaryTrade.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, market: true, side: true, stake: true, status: true, createdAt: true, user: { select: userSelect } },
    }),
    db.forexTrade.aggregate({
      where: { openedAt: { gte: since } },
      _count: true,
      _sum: { margin: true, profitLoss: true },
    }),
    db.forexTrade.findMany({ where: { openedAt: { gte: since } }, distinct: ["userId"], select: { userId: true } }),
    db.forexTrade.findMany({
      where: { openedAt: { gte: since } },
      orderBy: { openedAt: "desc" },
      take: 30,
      select: { id: true, symbol: true, direction: true, margin: true, profitLoss: true, status: true, openedAt: true, user: { select: userSelect } },
    }),
    db.p2POrder.aggregate({
      where: { createdAt: { gte: since } },
      _count: true,
      _sum: { fiatAmount: true, cryptoAmount: true },
    }),
    db.p2POrder.findMany({ where: { createdAt: { gte: since } }, distinct: ["buyerId"], select: { buyerId: true } }),
    db.p2POrder.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, crypto: true, fiatAmount: true, status: true, createdAt: true, buyer: { select: userSelect } },
    }),
  ]);

  const products = [
    {
      id: "sports",
      name: "Sportsbook",
      players: sportsPlayers.length,
      activity: sports._count,
      volume: Number(sports._sum.stake ?? 0),
      payout: Number(sports._sum.winAmount ?? 0),
      exposure: Number(sports._sum.potentialWin ?? 0),
      recent: sportsRecent.map((item) => ({ ...item, amount: Number(item.stake), at: item.createdAt })),
    },
    {
      id: "predictions",
      name: "Polymarket",
      players: predictionPlayers.length,
      activity: predictions._count,
      volume: Number(predictions._sum.stake ?? 0),
      payout: Number(predictions._sum.winAmount ?? 0),
      exposure: Number(predictions._sum.potentialWin ?? 0),
      recent: predictionRecent.map((item) => ({ ...item, amount: Number(item.stake), at: item.createdAt })),
    },
    {
      id: "aviator",
      name: "Aviator",
      players: aviatorPlayers.length,
      activity: aviator._count,
      volume: Number(aviator._sum.betAmount ?? 0),
      payout: Number(aviator._sum.winAmount ?? 0),
      exposure: 0,
      recent: aviatorRecent.map((item) => ({ ...item, amount: Number(item.betAmount), at: item.placedAt })),
    },
    {
      id: "binary",
      name: "Binary",
      players: binaryPlayers.length,
      activity: binary._count,
      volume: Number(binary._sum.stake ?? 0),
      payout: 0,
      exposure: Number(binary._sum.payout ?? 0),
      recent: binaryRecent.map((item) => ({ ...item, amount: Number(item.stake), at: item.createdAt })),
    },
    {
      id: "forex",
      name: "Forex",
      players: forexPlayers.length,
      activity: forex._count,
      volume: Number(forex._sum.margin ?? 0),
      payout: Number(forex._sum.profitLoss ?? 0),
      exposure: 0,
      recent: forexRecent.map((item) => ({ ...item, amount: Number(item.margin), at: item.openedAt })),
    },
    {
      id: "p2p",
      name: "P2P",
      players: p2pBuyers.length,
      activity: p2p._count,
      volume: Number(p2p._sum.fiatAmount ?? 0),
      payout: 0,
      exposure: 0,
      recent: p2pRecent.map((item) => ({ ...item, amount: Number(item.fiatAmount), at: item.createdAt, user: item.buyer })),
    },
  ];

  return Response.json({
    rangeMinutes: minutes,
    products,
    totals: {
      players: products.reduce((sum, product) => sum + product.players, 0),
      activity: products.reduce((sum, product) => sum + product.activity, 0),
      volume: products.reduce((sum, product) => sum + product.volume, 0),
      payout: products.reduce((sum, product) => sum + product.payout, 0),
    },
  });
}
