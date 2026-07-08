/**
 * Periodic binary/directional health digest (see lib/binary/rtp-summary).
 * Always sends a Telegram summary of realized RTP over the window — healthy or
 * drifting. Run from cron with `Authorization: Bearer $CRON_SECRET`, e.g. 6-hourly.
 */
import { runRtpSummary } from "@/lib/binary/rtp-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runRtpSummary();
    return Response.json({ ok: true, ...result });
  } catch (e) {
    console.error("[rtp-summary] failed", e);
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
