import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const merchant = await db.merchantProfile.findUnique({
    where: { userId: dbUser.id },
    include: {
      ads: { where: { isActive: true }, select: { id: true } },
    },
  });

  if (!merchant) {
    return Response.json({ isMerchant: false });
  }

  return Response.json({
    isMerchant:      true,
    kycStatus:       merchant.kycStatus,
    isOnline:        merchant.isOnline,
    displayName:     merchant.displayName,
    avatarUrl:       merchant.avatarUrl,
    completedTrades: merchant.completedTrades,
    completionRate:  Number(merchant.completionRate),
    activeAds:       merchant.ads.length,
  });
}

// PATCH — update the merchant's display name and/or avatar.
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
    if (!merchant) return Response.json({ error: "Merchant account required" }, { status: 403 });

    let body: { displayName?: string; avatarUrl?: string };
    try { body = await req.json(); } catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }

    const data: { displayName?: string; avatarUrl?: string | null } = {};
    if (body.displayName !== undefined) {
      const name = String(body.displayName).trim();
      if (name.length < 2 || name.length > 30) return Response.json({ error: "Display name must be 2–30 characters" }, { status: 400 });
      data.displayName = name;
    }
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl ? String(body.avatarUrl) : null;
    if (Object.keys(data).length === 0) return Response.json({ error: "Nothing to update" }, { status: 400 });

    const updated = await db.merchantProfile.update({
      where: { id: merchant.id },
      data,
      select: { displayName: true, avatarUrl: true },
    });
    return Response.json(updated);
  } catch (err) {
    console.error("PATCH /api/p2p/merchant/profile:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — presence heartbeat. Marks the merchant seen now (drives "Online").
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ ok: false });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    await db.merchantProfile.updateMany({
      where: {
        userId: dbUser.id,
        OR: [
          { lastSeenAt: null },
          { lastSeenAt: { lt: new Date(Date.now() - 60_000) } },
        ],
      },
      data:  { lastSeenAt: new Date(), isOnline: true },
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false });
  }
}
