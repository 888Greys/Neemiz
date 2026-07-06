/**
 * Runtime RTP guard (see lib/binary/rtp-guard). Auto-halts a binary contract
 * kind whose realized RTP breaches the house-loss threshold over volume, and
 * flags high-RTP players. Run from cron with `Authorization: Bearer $CRON_SECRET`.
 */
import { runRtpGuard } from "@/lib/binary/rtp-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runRtpGuard();
    if (result.halted.length) console.log(`[rtp-guard] AUTO-HALTED: ${result.halted.join(", ")}`);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    console.error("[rtp-guard] failed", e);
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
