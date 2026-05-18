import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { walletBalance: true, currency: true },
  });

  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  return Response.json({
    balance: Number(user.walletBalance),
    currency: user.currency,
  });
}
