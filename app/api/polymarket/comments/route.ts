import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export const runtime = "nodejs";

function isMigrationPending(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error.code === "P2021" || error.code === "P2022");
}

function marketSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "market";
}

function serializeComment(comment: {
  id: string;
  body: string;
  createdAt: Date;
  user: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    polymarketBets: Array<{ outcome: string }>;
  };
}) {
  const displayName = comment.user.username
    ?? [comment.user.firstName, comment.user.lastName].filter(Boolean).join(" ")
    ?? "Trader";

  return {
    id: comment.id,
    authorId: comment.user.id,
    author: displayName || "Trader",
    avatarUrl: comment.user.imageUrl,
    body: comment.body,
    createdAt: comment.createdAt,
    holder: comment.user.polymarketBets[0]?.outcome ?? null,
  };
}

export async function GET(req: Request) {
  const marketId = new URL(req.url).searchParams.get("marketId")?.trim();
  if (!marketId) return Response.json({ error: "marketId is required" }, { status: 400 });

  try {
    const comments = await db.polymarketComment.findMany({
      where: { marketId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            polymarketBets: {
              where: { marketId },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { outcome: true },
            },
          },
        },
      },
    });

    return Response.json(comments.map(serializeComment), {
      headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=20" },
    });
  } catch (error) {
    if (isMigrationPending(error)) return Response.json([]);
    throw error;
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to comment" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email, phone: user.phone });
  const body = await req.json().catch(() => null) as {
    marketId?: string;
    question?: string;
    body?: string;
  } | null;
  const marketId = body?.marketId?.trim();
  const text = body?.body?.trim();

  if (!marketId || !text) return Response.json({ error: "Comment cannot be empty" }, { status: 400 });
  if (text.length > 280) return Response.json({ error: "Comment must be 280 characters or less" }, { status: 400 });

  let comment;
  try {
    comment = await db.polymarketComment.create({
      data: { marketId, userId: dbUser.id, body: text },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            polymarketBets: {
              where: { marketId },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { outcome: true },
            },
          },
        },
      },
    });
  } catch (error) {
    if (isMigrationPending(error)) {
      return Response.json({ error: "Comments are being activated. Please retry shortly." }, { status: 503 });
    }
    throw error;
  }

  const bettors = await db.polymarketBet.findMany({
    where: { marketId, userId: { not: dbUser.id } },
    distinct: ["userId"],
    select: { userId: true },
    take: 1000,
  });
  const author = dbUser.username
    || [dbUser.firstName, dbUser.lastName].filter(Boolean).join(" ")
    || "A trader";
  const marketLabel = body?.question?.trim().slice(0, 90) || "a market you traded";
  const marketLink = `/predictions/${marketSlug(body?.question?.trim() || "market")}/${marketId}`;

  if (bettors.length > 0) {
    await db.notification.createMany({
      data: bettors.map(({ userId }) => ({
        userId,
        type: "polymarket_comment",
        title: `New comment on ${marketLabel}`,
        body: `${author}: ${text.slice(0, 140)}`,
        link: marketLink,
      })),
    });
  }

  return Response.json(serializeComment(comment), { status: 201 });
}
