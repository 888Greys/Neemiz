import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getOrCreateUser(userId);

  return Response.json({
    balance: Number(user.walletBalance),
    currency: user.currency,
  });
}
