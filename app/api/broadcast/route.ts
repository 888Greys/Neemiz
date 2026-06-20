import { getActiveBroadcasts } from "@/lib/broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/broadcast — public list of currently-live broadcasts. */
export async function GET() {
  try {
    const broadcasts = await getActiveBroadcasts();
    return Response.json(broadcasts, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[broadcast] GET error:", err);
    // Never break page chrome over a banner — degrade to empty.
    return Response.json([], { headers: { "Cache-Control": "no-store" } });
  }
}
