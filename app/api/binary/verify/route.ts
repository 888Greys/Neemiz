import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getServerTickHistory } from "@/lib/binary-price";
import {
  verifyDigitOutcome,
  verifyDigitQuoteSignature,
  verifyReveal,
  type DigitQuoteTerms,
} from "@/lib/binary/provably-fair";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Check = { status: "pass" | "fail" | "pending" | "skipped"; detail?: string };
const pass = (detail?: string): Check => ({ status: "pass", detail });
const fail = (detail?: string): Check => ({ status: "fail", detail });
const pending = (detail?: string): Check => ({ status: "pending", detail });
const skipped = (detail?: string): Check => ({ status: "skipped", detail });

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tradeId = new URL(req.url).searchParams.get("tradeId");
  if (!tradeId) return Response.json({ error: "Missing tradeId" }, { status: 400 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const trade = await db.binaryTrade.findUnique({ where: { id: tradeId } });
  if (!trade) return Response.json({ error: "Trade not found" }, { status: 404 });
  if (trade.userId !== dbUser.id && !dbUser.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  if (!trade.pfCommitment || !trade.pfSignature || !trade.pfClientSeed || !trade.pfNonce || trade.pfPayoutMultiplier == null || trade.entryEpoch == null) {
    return Response.json({
      tradeId: trade.id,
      status: trade.status,
      available: false,
      reason: "No provably-fair proof is attached to this trade.",
    });
  }

  const terminal = trade.status !== "PENDING";
  const terms: DigitQuoteTerms = {
    market: trade.market,
    side: trade.side as DigitQuoteTerms["side"],
    targetDigit: trade.targetDigit,
    entryEpoch: trade.entryEpoch,
    durationTicks: trade.durationTicks,
    payoutMultiplier: Number(trade.pfPayoutMultiplier),
    commitment: trade.pfCommitment,
    clientSeed: trade.pfClientSeed,
    nonce: Number(trade.pfNonce),
  };

  const signature = verifyDigitQuoteSignature(terms, trade.pfSignature)
    ? pass("Signed quote terms are intact.")
    : fail("Signed quote terms do not match the stored signature.");

  const reveal = !terminal
    ? pending("Server seed is revealed after settlement.")
    : trade.pfServerSeed
      ? verifyReveal(trade.pfServerSeed, trade.pfCommitment)
        ? pass("Revealed server seed matches the original commitment.")
        : fail("Revealed server seed does not match the original commitment.")
      : fail("Trade is settled but the server seed is missing.");

  let outcome: Check = !terminal
    ? pending("Trade is not settled yet.")
    : trade.status === "VOID"
      ? skipped("Trade was voided/refunded, so there is no market outcome to replay.")
      : skipped("Outcome replay was not attempted.");
  let replay: { won: boolean; credit: number; paid: number; exitDigit: number | null } | null = null;

  if (terminal && trade.status !== "VOID") {
    try {
      const hist = await getServerTickHistory(trade.market, trade.entryEpoch, trade.durationTicks + 50);
      const r = verifyDigitOutcome(terms, hist, Number(trade.stake));
      const paid = trade.status === "WON" ? Number(trade.payout) : 0;
      const matched = r.ready
        && r.won === (trade.status === "WON")
        && Math.abs(r.credit - paid) < 0.01;
      replay = { won: r.won, credit: r.credit, paid, exitDigit: r.exitDigit };
      outcome = matched
        ? pass("Public tick replay matches the settled result and paid amount.")
        : fail("Public tick replay does not match the settled result or paid amount.");
    } catch (err) {
      outcome = skipped(`Could not fetch public ticks for replay: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return Response.json({
    tradeId: trade.id,
    status: trade.status,
    available: true,
    terms,
    proof: {
      commitment: trade.pfCommitment,
      signature: trade.pfSignature,
      clientSeed: trade.pfClientSeed,
      nonce: trade.pfNonce,
      serverSeed: terminal ? trade.pfServerSeed : null,
    },
    checks: { signature, reveal, outcome },
    replay,
  });
}
