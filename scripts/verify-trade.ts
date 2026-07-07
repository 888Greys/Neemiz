// ─────────────────────────────────────────────────────────────────────────────
// PROVABLY-FAIR VERIFIER  —  bunx tsx scripts/verify-trade.ts <tradeId>
//
// Independently re-checks a settled directional trade:
//   1. REVEAL   — SHA256(serverSeed) === committed hash (quote pre-existed)
//   2. SIGNATURE— the signed terms are intact (needs PROVABLY_FAIR_SECRET; run
//                 server-side). Proves the terms weren't altered after the fact.
//   3. OUTCOME  — replay the committed terms against the PUBLIC Deriv ticks from
//                 the committed entryEpoch through the open-source kernel, and
//                 confirm it matches the won/lost + credit the server paid.
//
// (3) is the core fairness proof and needs no secret — anyone can run it. Deriv
// keeps ~recent tick history, so replay works best on recent trades.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import { getServerTickHistory } from "@/lib/binary-price";
import { verifyQuoteSignature, verifyReveal, verifyOutcome, type QuoteTerms } from "@/lib/binary/provably-fair";

const ok = (b: boolean) => (b ? "✅ PASS" : "❌ FAIL");

async function main() {
  const tradeId = process.argv[2];
  if (!tradeId) { console.error("usage: bunx tsx scripts/verify-trade.ts <tradeId>"); process.exit(1); }

  const trade = await db.directionalTrade.findUnique({ where: { id: tradeId } });
  if (!trade) { console.error(`trade ${tradeId} not found`); process.exit(1); }
  if (trade.status === "PENDING") { console.log("trade not settled yet"); process.exit(0); }

  const stakeTx = await db.transaction.findFirst({ where: { reference: `directional-stake-${trade.userId}-${trade.id}` } });
  const legacyPf = (stakeTx?.metadata as Record<string, unknown> | null)?.pf as
    | { commitment?: string; signature?: string; serverSeed?: string; clientSeed?: string; nonce?: number | string; payoutMultiplier?: number }
    | undefined;
  const pf = trade.pfCommitment && trade.pfSignature && trade.pfClientSeed && trade.pfNonce && trade.pfPayoutMultiplier != null
    ? {
        commitment: trade.pfCommitment,
        signature: trade.pfSignature,
        serverSeed: trade.pfServerSeed ?? undefined,
        clientSeed: trade.pfClientSeed,
        nonce: trade.pfNonce,
        payoutMultiplier: Number(trade.pfPayoutMultiplier),
      }
    : legacyPf;
  if (!pf) { console.log("no provably-fair proof on this trade (VANILLA or pre-feature)"); process.exit(0); }
  if (!pf.serverSeed) { console.log("server seed is not revealed yet"); process.exit(0); }

  const terms: QuoteTerms = {
    market: trade.market, kind: trade.kind as QuoteTerms["kind"], side: trade.side as QuoteTerms["side"],
    entrySpot: Number(trade.entrySpot), entryEpoch: trade.entryEpoch,
    barrier: trade.barrier == null ? null : Number(trade.barrier),
    durationTicks: trade.durationTicks, payoutMultiplier: Number(pf.payoutMultiplier),
    commitment: String(pf.commitment), clientSeed: String(pf.clientSeed), nonce: Number(pf.nonce),
  };

  console.log(`\nTrade ${trade.id}  —  ${trade.market} ${trade.kind}/${trade.side}  status=${trade.status}`);
  console.log(`entry ${terms.entrySpot} @ epoch ${terms.entryEpoch}  barrier=${terms.barrier ?? "-"}  dur=${terms.durationTicks}  payout×${terms.payoutMultiplier}`);

  // 1 + 2: cryptographic checks
  const revealOk = verifyReveal(pf.serverSeed, String(pf.commitment));
  const sigOk = verifyQuoteSignature(terms, String(pf.signature));
  console.log(`\n1. reveal  SHA256(serverSeed)==commitment   ${ok(revealOk)}`);
  console.log(`2. signature  terms intact                  ${ok(sigOk)}  ${sigOk ? "" : "(set PROVABLY_FAIR_SECRET; run server-side)"}`);

  // 3: replay against public Deriv ticks
  let outcomeLine = "3. outcome  replay vs public ticks         ⚠️ SKIPPED (ticks unavailable)";
  try {
    const hist = await getServerTickHistory(trade.market, trade.entryEpoch, trade.durationTicks + 50);
    const forward = hist.filter((h) => h.epoch > trade.entryEpoch).map((h) => ({ price: h.price, epoch: h.epoch }));
    if (forward.length >= trade.durationTicks) {
      const replay = verifyOutcome(terms, forward, Number(trade.stake));
      const paid = trade.status === "WON" ? Number(trade.payout) : 0;
      const match = replay.ready && replay.won === (trade.status === "WON") && Math.abs(replay.credit - paid) < 0.01;
      outcomeLine = `3. outcome  replay says ${replay.won ? "WON" : "LOST"} credit ${replay.credit}, server ${trade.status} paid ${paid}  ${ok(match)}`;
    }
  } catch (e) {
    outcomeLine = `3. outcome  replay error: ${e instanceof Error ? e.message : e}`;
  }
  console.log(outcomeLine);

  console.log(`\nserverSeed (revealed): ${pf.serverSeed}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
