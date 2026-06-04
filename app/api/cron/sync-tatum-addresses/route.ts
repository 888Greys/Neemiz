import { db } from "@/lib/db";
import { registerTatumAddress } from "@/lib/crypto/tatum";

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
    where: { network: { in: ["BITCOIN", "TRC20"] } },
    select: { address: true, network: true },
  });

  const uniqueRows = Array.from(
    new Map(rows.map((row) => [`${row.network}:${row.address.toLowerCase()}`, row])).values(),
  );

  let registered = 0;
  let skipped = 0;
  const errors: Array<{ address: string; network: string; error: string }> = [];

  for (const row of uniqueRows) {
    const result = await registerTatumAddress(row.address, row.network);
    if (result.ok && !result.skipped) registered++;
    else if (result.ok || result.skipped) skipped++;
    else errors.push({
      address: row.address,
      network: row.network,
      error:   result.error ?? String(result.status ?? "failed"),
    });
  }

  return Response.json({
    ok: errors.length === 0,
    checked: uniqueRows.length,
    registered,
    skipped,
    errors,
  });
}
