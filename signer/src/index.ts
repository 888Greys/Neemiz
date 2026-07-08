/**
 * Signer service — the only host that holds the master seed.
 *
 * Reachable ONLY over the WireGuard tunnel from nez. Accepts HMAC-signed,
 * timestamped withdrawal requests, enforces its own spend caps, signs, and
 * broadcasts. A compromise of the web app cannot move funds without also
 * producing a valid HMAC AND staying under the signer's caps.
 */
import express from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { broadcastWithdrawal } from "./broadcaster";
import { assertWithinPolicy, recordSpend, priorTxHash, recordTxHash, PolicyError } from "./policy";
import { isHalted, haltFilePath } from "./halt";
import { alert } from "./alert";

const PORT     = Number(process.env.SIGNER_PORT ?? 8787);
const BIND     = process.env.SIGNER_BIND ?? "0.0.0.0"; // set to the WG IP in prod
const SECRET   = process.env.SIGNER_HMAC_SECRET;
const MAX_SKEW = Number(process.env.SIGNER_MAX_SKEW_MS ?? 90_000);

if (!SECRET) { console.error("FATAL: SIGNER_HMAC_SECRET is not set"); process.exit(1); }
if (!process.env.MASTER_WALLET_MNEMONIC) { console.error("FATAL: MASTER_WALLET_MNEMONIC is not set"); process.exit(1); }

const app = express();
app.use(express.raw({ type: "*/*", limit: "16kb" }));

app.get("/health", (_req, res) => res.json({ ok: true, halted: isHalted() }));

function explorerFor(network: string, txHash: string): string {
  return network === "TRC20"   ? `https://tronscan.org/#/transaction/${txHash}`
       : network === "BITCOIN" ? `https://mempool.space/tx/${txHash}`
       : network === "BEP20"   ? `https://bscscan.com/tx/${txHash}`
       : network === "POLYGON" ? `https://polygonscan.com/tx/${txHash}`
       :                         `https://etherscan.io/tx/${txHash}`;
}

function verifyHmac(ts: string, rawBody: string, providedHex: string): boolean {
  const expected = createHmac("sha256", SECRET!).update(`${ts}.${rawBody}`).digest();
  let provided: Buffer;
  try { provided = Buffer.from(providedHex, "hex"); } catch { return false; }
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

// Serialize all signing so concurrent requests can't race the nonce or the cap.
let chain: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

interface SignBody {
  hdIndex: number | null;
  fromAddress: string;
  to: string;
  crypto: string;
  network: string;
  amount: number;
  idempotencyKey: string;
}

app.post("/sign-withdrawal", async (req, res) => {
  // 0. KILL SWITCH — refuse to sign anything while halted. Checked first so a halt
  //    overrides a valid HMAC and a request that would otherwise be within caps.
  //    Fail-closed and instant: flipping the flag needs no restart.
  if (isHalted()) {
    console.warn("[signer] HALTED — refused a withdrawal request");
    return res.status(503).json({ ok: false, error: "Signing is halted", code: "SIGNING_HALTED" });
  }

  const ts  = String(req.header("X-Signer-Timestamp") ?? "");
  const sig = String(req.header("X-Signer-Signature") ?? "");
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";

  // 1. anti-replay window
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > MAX_SKEW) {
    return res.status(401).json({ ok: false, error: "Stale or missing timestamp" });
  }
  // 2. auth
  if (!sig || !verifyHmac(ts, rawBody, sig)) {
    await alert("🚨 <b>Signer</b>: rejected request with bad/missing HMAC signature.");
    return res.status(401).json({ ok: false, error: "Bad signature" });
  }
  // 3. parse + validate
  let body: SignBody;
  try { body = JSON.parse(rawBody); } catch { return res.status(400).json({ ok: false, error: "Invalid JSON" }); }
  const { fromAddress, to, crypto, network, amount, idempotencyKey } = body ?? {};
  if (!fromAddress || !to || !crypto || !network || !idempotencyKey || !Number.isFinite(Number(amount))) {
    return res.status(400).json({ ok: false, error: "Missing required fields" });
  }
  const amt = Number(amount);

  try {
    const result = await enqueue(async () => {
      // idempotent replay — never broadcast the same withdrawal twice
      const prior = priorTxHash(idempotencyKey);
      if (prior) return { txHash: prior, network, explorer: explorerFor(network, prior), replay: true };

      assertWithinPolicy(crypto, amt);
      const br = await broadcastWithdrawal({ hdIndex: body.hdIndex ?? null, fromAddress, to, crypto, network, amount: amt });
      recordSpend(crypto, amt);
      recordTxHash(idempotencyKey, br.txHash);
      return { ...br, replay: false };
    });

    if (!("replay" in result) || !result.replay) {
      await alert(`✅ <b>Signer</b>: sent ${amt} ${crypto} (${network})\nto <code>${to}</code>\n<a href="${result.explorer}">tx</a>`);
    }
    return res.json({ ok: true, txHash: result.txHash, network: result.network, explorer: result.explorer });
  } catch (err) {
    if (err instanceof PolicyError) {
      await alert(`⛔ <b>Signer</b>: BLOCKED ${amt} ${crypto} (${network}) — ${err.code}\nto <code>${to}</code>`);
      return res.status(403).json({ ok: false, error: err.message, code: err.code });
    }
    const msg = err instanceof Error ? err.message : "Broadcast failed";
    await alert(`❗ <b>Signer</b>: broadcast error for ${amt} ${crypto} (${network}) — ${msg}`);
    console.error("[signer] broadcast error:", msg);
    return res.status(502).json({ ok: false, error: msg });
  }
});

app.listen(PORT, BIND, () => {
  console.log(`[signer] listening on ${BIND}:${PORT}`);
  if (isHalted()) {
    console.warn(`[signer] ⚠ STARTED IN HALTED STATE — kill switch is on (${haltFilePath()}). No withdrawals will be signed until it is cleared.`);
  }
});
