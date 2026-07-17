/**
 * Check LIVE on-chain balances for BITCOIN and POLYGON deposit addresses and
 * print only the ones that currently hold funds. Needs only internet access —
 * no database, no prod credentials.
 *
 * Usage:
 *   1. In the admin "Deposit addresses" page, click "Copy all".
 *   2. Paste into a file, e.g. scripts/addresses.txt
 *   3. bun run scripts/check-onchain-balances.ts scripts/addresses.txt
 *
 * Only BITCOIN and POLYGON are scanned (USDT-TRC20 is intentionally skipped).
 */
import { readFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: bun run scripts/check-onchain-balances.ts <addresses.txt>");
  process.exit(1);
}

// ─── Parse the "=== NETWORK (n) ===" grouped dump ─────────────────────────────
type Row = { address: string; network: string; crypto: string; owner: string };
const rows: Row[] = [];
let net = "";
for (const raw of readFileSync(file, "utf8").split("\n")) {
  const line = raw.trim();
  const header = line.match(/^===\s*([A-Z0-9]+)/);
  if (header) { net = header[1]; continue; }
  if (!line || !net) continue;
  const [address, crypto, owner] = line.split("\t").map((s) => s?.trim());
  if (address) rows.push({ address, network: net, crypto: crypto ?? "", owner: owner ?? "" });
}

// ─── Polygon token contracts ──────────────────────────────────────────────────
const POLYGON_RPC = "https://polygon-bor-rpc.publicnode.com";
const POLY_TOKENS: Record<string, { contract: string; decimals: number }> = {
  "USDT":      { contract: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
  "USDC":      { contract: "0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359", decimals: 6 }, // native
  "USDC.e":    { contract: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6 }, // bridged
};

async function polygonBalance(address: string, contract: string, decimals: number): Promise<number> {
  const data = "0x70a08231" + address.slice(2).toLowerCase().padStart(64, "0");
  const res = await fetch(POLYGON_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: contract, data }, "latest"] }),
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json();
  const hex = json?.result;
  if (!hex || hex === "0x") return 0;
  return Number(BigInt(hex)) / 10 ** decimals;
}

async function btcBalance(address: string): Promise<number> {
  for (const base of ["https://blockstream.info/api", "https://mempool.space/api"]) {
    try {
      const res = await fetch(`${base}/address/${address}`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const d = await res.json();
      const s = d?.chain_stats;
      return ((s?.funded_txo_sum ?? 0) - (s?.spent_txo_sum ?? 0)) / 1e8;
    } catch { /* try next */ }
  }
  return 0;
}

// ─── Bounded-concurrency runner ───────────────────────────────────────────────
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try { out[i] = await fn(items[i], i); } catch { out[i] = null as R; }
      if (i % 25 === 0) process.stderr.write(`  …${i}/${items.length}\n`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// Dedupe Polygon addresses (each appears once per token in the dump).
const btc = rows.filter((r) => r.network === "BITCOIN");
const polyAddrs = [...new Map(rows.filter((r) => r.network === "POLYGON").map((r) => [r.address, r])).values()];

console.error(`Scanning ${btc.length} BTC and ${polyAddrs.length} Polygon addresses…`);

type Hit = { network: string; address: string; owner: string; balances: string };

const btcHits = (await mapLimit(btc, 8, async (r) => {
  const bal = await btcBalance(r.address);
  return bal > 0 ? { network: "BITCOIN", address: r.address, owner: r.owner, balances: `${bal} BTC` } : null;
})).filter(Boolean) as Hit[];

const polyHits = (await mapLimit(polyAddrs, 8, async (r) => {
  const parts: string[] = [];
  for (const [sym, t] of Object.entries(POLY_TOKENS)) {
    const bal = await polygonBalance(r.address, t.contract, t.decimals);
    if (bal > 0) parts.push(`${bal} ${sym}`);
  }
  return parts.length ? { network: "POLYGON", address: r.address, owner: r.owner, balances: parts.join(", ") } : null;
})).filter(Boolean) as Hit[];

const hits = [...btcHits, ...polyHits];
console.log(`\n===== ADDRESSES WITH FUNDS (${hits.length}) =====`);
if (hits.length === 0) console.log("None — every scanned address is empty.");
for (const h of hits) console.log(`${h.network}\t${h.balances}\t${h.address}\t${h.owner}`);
