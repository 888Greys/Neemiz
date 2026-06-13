import { db } from "@/lib/db";

export const DAILY_P2P_CANCELLATION_LIMIT = 3;

function nairobiDayBounds(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = value("year");
  const month = value("month");
  const day = value("day");
  const start = new Date(Date.UTC(year, month - 1, day, -3));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function getP2PCancellationUsage(userId: string, now = new Date()) {
  const { start, end } = nairobiDayBounds(now);
  const count = await db.p2POrder.count({
    where: {
      updatedAt: { gte: start, lt: end },
      OR: [
        { status: "CANCELLED", cancelledBy: userId },
        { status: "EXPIRED", ad: { side: "SELL" }, buyerId: userId },
        { status: "EXPIRED", ad: { side: "BUY" }, seller: { userId } },
      ],
    },
  });

  return {
    count,
    limit: DAILY_P2P_CANCELLATION_LIMIT,
    restricted: count >= DAILY_P2P_CANCELLATION_LIMIT,
    resetsAt: end,
  };
}

export async function assertCanCreateP2POrder(userId: string) {
  const usage = await getP2PCancellationUsage(userId);
  if (!usage.restricted) return null;

  return Response.json({
    error: "P2P ordering is paused after 3 cancellations or payment timeouts today.",
    code: "P2P_DAILY_CANCELLATION_LIMIT",
    cancellationCount: usage.count,
    resetsAt: usage.resetsAt.toISOString(),
  }, { status: 429 });
}
