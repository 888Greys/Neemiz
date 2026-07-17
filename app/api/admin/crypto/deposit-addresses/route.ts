import { requireOwnerAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function family(network: string): string {
  if (network === "TRC20") return "TRON";
  if (network === "BITCOIN") return "BTC";
  return "EVM";
}

// Every generated crypto deposit address, for the Treasury → Addresses tab.
export async function GET() {
  if (!(await requireOwnerAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const addresses = await db.cryptoDepositAddress.findMany({
    include: { user: { select: { email: true, username: true } } },
    orderBy: [{ network: "asc" }, { createdAt: "asc" }],
  });

  const rows = addresses.map((a) => ({
    address: a.address,
    crypto: a.crypto,
    network: a.network,
    family: family(a.network),
    owner: a.user.email ?? a.user.username ?? a.userId,
    createdAt: a.createdAt.toISOString(),
  }));

  return Response.json({ rows }, { headers: { "Cache-Control": "no-store" } });
}
