import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// GET /api/p2p/merchant/deposit — list the merchant's own crypto deposit requests
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
  if (!merchant) return Response.json({ error: "Merchant account required" }, { status: 403 });

  const deposits = await db.p2PCryptoDeposit.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(deposits);
}

// POST /api/p2p/merchant/deposit — submit a new crypto deposit request
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
  if (!merchant) return Response.json({ error: "Merchant account required" }, { status: 403 });

  const body = await req.json();
  const { crypto, amount, txHash, network } = body as {
    crypto: string;
    amount: number;
    txHash?: string;
    network?: string;
  };

  if (!crypto || !amount || amount <= 0) {
    return Response.json({ error: "crypto and a positive amount are required" }, { status: 400 });
  }

  const deposit = await db.p2PCryptoDeposit.create({
    data: {
      merchantId: merchant.id,
      crypto,
      amount,
      txHash: txHash ?? null,
      network: network ?? "TRC20",
      status: "PENDING",
    },
  });

  return Response.json(deposit, { status: 201 });
}
