import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getOrCreateUser(userId);

  const txns = await db.transaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      type: true,
      amount: true,
      currency: true,
      status: true,
      provider: true,
      createdAt: true,
    },
  });

  return Response.json(
    txns.map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      currency: t.currency,
      status: t.status,
      provider: t.provider,
      createdAt: t.createdAt,
    }))
  );
}
