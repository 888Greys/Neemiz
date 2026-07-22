/**
 * Native EVM deposit backstop (Etherscan-free). Credits ETH/BNB/POL deposits by
 * comparing on-chain balance (public RPC) to the credited ledger. Idempotent;
 * capped by the clawback reconcile so it can never over-credit.
 *
 * GET/POST ?dryRun=1  — report only (default)
 * GET/POST ?dryRun=0  — apply credits (CRON_SECRET)
 */
import { reconcileNativeEvmUp } from "@/lib/crypto/native-evm-reconcile";

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
  const result = await reconcileNativeEvmUp({ dryRun });
  return Response.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
