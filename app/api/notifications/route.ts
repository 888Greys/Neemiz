import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser, SuspendedAccountError } from "@/lib/get-or-create-user";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    const [notifications, transactions] = await Promise.all([
      db.notification.findMany({
        where: { userId: dbUser.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      db.transaction.findMany({
        where: {
          userId: dbUser.id,
          type: { in: ["DEPOSIT", "WITHDRAWAL", "REFUND"] },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          type: true,
          amount: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);
    return Response.json({
      userId: dbUser.id,
      notifications,
      transactions: transactions.map((transaction) => ({
        ...transaction,
        amount: Number(transaction.amount),
      })),
    }, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    if (error instanceof SuspendedAccountError) {
      return Response.json({ error: "Account suspended" }, { status: 403 });
    }
    throw error;
  }
}

export async function PATCH() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  await db.notification.updateMany({
    where: { userId: dbUser.id, isRead: false },
    data: { isRead: true },
  });
  return Response.json({ ok: true });
}
