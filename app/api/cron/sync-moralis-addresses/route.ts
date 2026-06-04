import { db } from "@/lib/db";
import { registerMoralisEvmAddress } from "@/lib/crypto/moralis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.cryptoDepositAddress.findMany({
    where: { network: { in: ["ERC20", "BEP20", "POLYGON"] } },
    select: { address: true },
  });
  const addresses = Array.from(new Set(rows.map((row) => row.address.toLowerCase())));

  let registered = 0;
  let skipped = 0;
  const errors: Array<{ address: string; error: string }> = [];

  for (const address of addresses) {
    const result = await registerMoralisEvmAddress(address);
    if (result.ok && !result.skipped) registered++;
    else if (result.ok || result.skipped) skipped++;
    else errors.push({ address, error: result.error ?? String(result.status ?? "failed") });
  }

  return Response.json({
    ok: errors.length === 0,
    checked: addresses.length,
    registered,
    skipped,
    errors,
  });
}
