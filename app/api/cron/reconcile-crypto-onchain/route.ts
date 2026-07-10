/**
 * Clamp user crypto ledgers to live on-chain balances on their CURRENT deposit
 * addresses. Use after HD seed migrations / when phantom balances linger.
 *
 * GET  ?dryRun=1  — report only (default)
 * POST ?dryRun=0  — apply clamps (CRON_SECRET or admin)
 */
import { reconcileCryptoToOnChain } from "@/lib/crypto/reconcile-onchain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

async function run(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") !== "0";
  const result = await reconcileCryptoToOnChain({ dryRun, concurrency: 4 });
  return Response.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
