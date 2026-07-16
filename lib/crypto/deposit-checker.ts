/**
 * On-chain deposit checking via Etherscan API V2 (multi-chain) and TronGrid (Tron).
 * Supported:
 *   EVM chains — Ethereum (1), BSC (56), Polygon (137)
 *   Tron       — TRC-20 tokens + native TRX
 */

import { createHash } from "crypto";
import { EVM_TOKENS } from "@/lib/crypto/token-registry";

const ETHERSCAN = "https://api.etherscan.io/v2/api";
const TRONGRID  = "https://api.trongrid.io";

// ─── Tron TRC-20 token contracts ──────────────────────────────────────────────
const TRC20_CONTRACTS: Record<string, string> = {
  USDT: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
};

const TRC20_CONTRACT_HEX: Record<string, string> = {
  USDT: "41a614f803b6fd780986a42c78ec9c7f77e6ded13c",
};

export interface DepositTx {
  txHash:    string;
  amount:    string; // human-readable, e.g. "100.000000"
  from:      string;
  timestamp: number; // ms
  logIndex?: string;
  /** false = seen in mempool / 0-conf (notify only, do not credit). Default true. */
  confirmed?: boolean;
}

interface DepositCheckOptions {
  backfillBep20?: boolean;
  txHash?:        string;
}

const EVM_RPC: Record<number, string> = {
  1:   "https://ethereum-rpc.publicnode.com",
  56:  "https://bsc-rpc.publicnode.com",
  137: "https://polygon-bor-rpc.publicnode.com",
};

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const BSC_LOG_SCAN_BLOCKS = 45_000;
const BSC_BACKFILL_SCAN_BLOCKS = 180_000;
const BSC_BACKFILL_CHUNK_BLOCKS = 1_500;
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(buf: Buffer): string {
  const digits: number[] = [0];
  for (let i = 0; i < buf.length; i++) {
    let carry = buf[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let leading = 0;
  for (let i = 0; i < buf.length && buf[i] === 0; i++) leading++;
  return "1".repeat(leading) + digits.reverse().map((d) => B58[d]).join("");
}

function tronHexToBase58(value: string): string {
  const hex = value.toLowerCase().replace(/^0x/, "");
  if (!/^41[0-9a-f]{40}$/.test(hex)) return value;
  const raw = Buffer.from(hex, "hex");
  const h1 = createHash("sha256").update(raw).digest();
  const h2 = createHash("sha256").update(h1).digest();
  return base58Encode(Buffer.concat([raw, h2.slice(0, 4)]));
}

async function rpcRequest<T>(chainId: number, method: string, params: unknown[]): Promise<T | null> {
  const rpc = EVM_RPC[chainId];
  if (!rpc) return null;
  const res = await fetch(rpc, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal:  AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.error) return null;
  return data?.result ?? null;
}

function addressTopic(address: string): string {
  return `0x${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
}

function formatUnits(value: string | bigint, decimals: number, fixed = 8): string {
  const raw = typeof value === "bigint" ? value : BigInt(value);
  const base = BigInt(10) ** BigInt(decimals);
  const whole = raw / base;
  const fraction = raw % base;
  const fractionText = fraction.toString().padStart(decimals, "0").slice(0, fixed).padEnd(fixed, "0");
  return `${whole}.${fractionText}`;
}

async function getBscTokenLogs(
  chainId: number,
  contract: string,
  address: string,
  fromBlock: number,
  toBlock: number | "latest",
): Promise<Array<{
  blockNumber: string;
  data: string;
  topics: string[];
  transactionHash: string;
  logIndex?: string;
}>> {
  const logs = await rpcRequest<Array<{
    blockNumber: string;
    data: string;
    topics: string[];
    transactionHash: string;
    logIndex?: string;
  }>>(chainId, "eth_getLogs", [{
    fromBlock: `0x${fromBlock.toString(16)}`,
    toBlock:   toBlock === "latest" ? "latest" : `0x${toBlock.toString(16)}`,
    address:   contract,
    topics:    [TRANSFER_TOPIC, null, addressTopic(address)],
  }]);
  return Array.isArray(logs) ? logs : [];
}

async function checkBscTokenDepositByHash(
  address: string,
  crypto: string,
  network: string,
  txHash: string,
): Promise<DepositTx[]> {
  const token = EVM_TOKENS[`${crypto}:${network}`];
  if (!token?.contract) return [];

  const receipt = await rpcRequest<{
    status?: string;
    logs?: Array<{
      address: string;
      data: string;
      topics: string[];
      transactionHash: string;
      logIndex?: string;
      blockTimestamp?: string;
    }>;
  }>(token.chainId, "eth_getTransactionReceipt", [txHash]);

  if (!receipt || receipt.status !== "0x1" || !Array.isArray(receipt.logs)) return [];

  return receipt.logs
    .filter((log) =>
      log.address?.toLowerCase() === token.contract.toLowerCase() &&
      log.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC &&
      log.topics?.[2]?.toLowerCase() === addressTopic(address),
    )
    .map((log) => ({
      txHash:    log.transactionHash,
      amount:    formatUnits(log.data, token.decimals, 8),
      from:      log.topics?.[1] ? `0x${log.topics[1].slice(-40)}` : "",
      timestamp: log.blockTimestamp ? Number(BigInt(log.blockTimestamp)) * 1000 : Date.now(),
      logIndex:  log.logIndex,
    }))
    .filter((tx) => Number(tx.amount) > 0);
}

async function checkBscTokenDeposits(
  address: string,
  crypto: string,
  network: string,
  opts: { backfill?: boolean; txHash?: string } = {},
): Promise<DepositTx[]> {
  const token = EVM_TOKENS[`${crypto}:${network}`];
  if (!token?.contract) return [];

  if (opts.txHash) return checkBscTokenDepositByHash(address, crypto, network, opts.txHash);

  const latestHex = await rpcRequest<string>(token.chainId, "eth_blockNumber", []);
  if (!latestHex) return [];
  const latest = Number(BigInt(latestHex));
  const from = Math.max(0, latest - BSC_LOG_SCAN_BLOCKS);

  let logs = await getBscTokenLogs(token.chainId, token.contract, address, from, "latest");

  if (opts.backfill) {
    const oldest = Math.max(0, latest - BSC_BACKFILL_SCAN_BLOCKS);
    for (let end = from - 1; end >= oldest; end -= BSC_BACKFILL_CHUNK_BLOCKS) {
      const start = Math.max(oldest, end - BSC_BACKFILL_CHUNK_BLOCKS + 1);
      logs = logs.concat(await getBscTokenLogs(token.chainId, token.contract, address, start, end));
    }
  }

  return logs
    .map((log) => ({
      txHash:    log.transactionHash,
      amount:    formatUnits(log.data, token.decimals, 8),
      from:      log.topics?.[1] ? `0x${log.topics[1].slice(-40)}` : "",
      timestamp: Date.now(),
      logIndex:  log.logIndex,
    }))
    .filter((tx) => Number(tx.amount) > 0);
}

// ─── EVM (multi-chain) via Etherscan API V2 ───────────────────────────────────

export async function checkEVMDeposits(
  address: string,
  crypto:  string,
  network: string,
  opts: DepositCheckOptions = {},
): Promise<DepositTx[]> {
  const token = EVM_TOKENS[`${crypto}:${network}`];
  if (!token) return [];
  if (token.chainId === 56 && token.contract) {
    return checkBscTokenDeposits(address, crypto, network, {
      backfill: opts.backfillBep20,
      txHash:   opts.txHash,
    });
  }

  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) throw new Error("ETHERSCAN_API_KEY not set");

  const url = new URL(ETHERSCAN);
  url.searchParams.set("chainid", String(token.chainId));
  url.searchParams.set("module",  "account");
  url.searchParams.set("address", address);
  url.searchParams.set("sort",    "desc");
  url.searchParams.set("apikey",  apiKey);

  const isNative = !token.contract;

  if (isNative) {
    url.searchParams.set("action", "txlist");
  } else {
    url.searchParams.set("action",          "tokentx");
    url.searchParams.set("contractaddress", token.contract);
  }

  const res  = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  if (data.status !== "1" || !Array.isArray(data.result)) return [];

  if (isNative) {
    return (data.result as Record<string, string>[])
      .filter((tx) =>
        tx.to?.toLowerCase() === address.toLowerCase() &&
        tx.isError === "0" &&
        Number(tx.value) > 0,
      )
      .map((tx) => ({
        txHash:    tx.hash,
        amount:    (Number(BigInt(tx.value)) / 1e18).toFixed(8),
      from:      tx.from,
      timestamp: Number(tx.timeStamp) * 1000,
      logIndex:  tx.transactionIndex,
    }));
  }

  return (data.result as Record<string, string>[])
    .filter((tx) => tx.to?.toLowerCase() === address.toLowerCase())
    .map((tx) => ({
      txHash:    tx.hash,
      amount:    (Number(tx.value) / 10 ** Number(tx.tokenDecimal)).toFixed(6),
      from:      tx.from,
      timestamp: Number(tx.timeStamp) * 1000,
      logIndex:  tx.logIndex,
    }));
}

// ─── Tron TRC-20 tokens via TronGrid ─────────────────────────────────────────

export async function checkTronTRC20Deposits(
  address:  string,
  crypto:   string,
  opts:     DepositCheckOptions = {},
): Promise<DepositTx[]> {
  const contract = TRC20_CONTRACTS[crypto];
  if (!contract) return [];

  if (opts.txHash) return checkTronTRC20DepositByHash(address, crypto, opts.txHash);

  const apiKey  = process.env.TRONGRID_API_KEY;
  const headers: Record<string, string> = apiKey ? { "TRON-PRO-API-KEY": apiKey } : {};

  const url = `${TRONGRID}/v1/accounts/${address}/transactions/trc20` +
    `?contract_address=${contract}&only_confirmed=true&limit=20`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data.data)) return [];

  return (data.data as Record<string, unknown>[])
    .filter((tx) => {
      const info = tx.token_info as Record<string, unknown> | undefined;
      return tx.to === address && info?.symbol === crypto;
    })
    .map((tx) => ({
      txHash:    tx.transaction_id as string,
      amount:    (Number(tx.value) / 1_000_000).toFixed(6),
      from:      tx.from as string,
      timestamp: Number(tx.block_timestamp),
      logIndex:  tx.transaction_id as string,
    }));
}

async function checkTronTRC20DepositByHash(
  address: string,
  crypto: string,
  txHash: string,
): Promise<DepositTx[]> {
  const contract = TRC20_CONTRACTS[crypto];
  if (!contract) return [];

  const apiKey  = process.env.TRONGRID_API_KEY;
  const headers: Record<string, string> = apiKey ? { "TRON-PRO-API-KEY": apiKey } : {};

  const accountUrl = `${TRONGRID}/v1/accounts/${address}/transactions/trc20` +
    `?contract_address=${contract}&only_confirmed=true&limit=200`;
  const accountRes = await fetch(accountUrl, { headers, cache: "no-store" });
  if (accountRes.ok) {
    const accountData = await accountRes.json();
    if (Array.isArray(accountData.data)) {
      const accountMatches = (accountData.data as Record<string, unknown>[])
        .filter((tx) => {
          const info = tx.token_info as Record<string, unknown> | undefined;
          return tx.transaction_id === txHash &&
            tx.to === address &&
            info?.symbol === crypto;
        })
        .map((tx) => ({
          txHash:    tx.transaction_id as string,
          amount:    (Number(tx.value) / 1_000_000).toFixed(6),
          from:      tx.from as string,
          timestamp: Number(tx.block_timestamp),
          logIndex:  tx.transaction_id as string,
        }))
        .filter((tx) => Number(tx.amount) > 0);
      if (accountMatches.length > 0) return accountMatches;
    }
  }

  const eventRes = await fetch(`${TRONGRID}/v1/transactions/${txHash}/events?only_confirmed=true`, {
    headers,
    cache: "no-store",
  });
  if (!eventRes.ok) return [];
  const eventData = await eventRes.json();
  if (!Array.isArray(eventData.data)) return [];

  const contractHex = TRC20_CONTRACT_HEX[crypto]?.toLowerCase();
  return (eventData.data as Record<string, unknown>[])
    .filter((event) => {
      const result = event.result as Record<string, unknown> | undefined;
      const eventContract = String(event.contract_address ?? "").toLowerCase().replace(/^0x/, "");
      const to = tronHexToBase58(String(result?.to ?? ""));
      const contractMatches = !eventContract ||
        eventContract === contract.toLowerCase() ||
        eventContract === contractHex;
      return event.event_name === "Transfer" &&
        contractMatches &&
        to === address;
    })
    .map((event) => {
      const result = event.result as Record<string, unknown> | undefined;
      return {
        txHash,
        amount:    (Number(result?.value ?? 0) / 1_000_000).toFixed(6),
        from:      tronHexToBase58(String(result?.from ?? "")),
        timestamp: Number(event.block_timestamp ?? Date.now()),
        logIndex:  String(event.event_index ?? event.log_index ?? txHash),
      };
    })
    .filter((tx) => Number(tx.amount) > 0);
}

// ─── Tron native TRX via TronGrid ────────────────────────────────────────────

export async function checkTronTRXDeposits(
  address: string,
  opts:    DepositCheckOptions = {},
): Promise<DepositTx[]> {
  const apiKey  = process.env.TRONGRID_API_KEY;
  const headers: Record<string, string> = apiKey ? { "TRON-PRO-API-KEY": apiKey } : {};

  const url = `${TRONGRID}/v1/accounts/${address}/transactions` +
    `?only_confirmed=true&only_to=true&limit=20`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data.data)) return [];

  const txs = (data.data as Record<string, unknown>[])
    .filter((tx) => {
      // Only plain TRX transfers (TransferContract), not TRC-20 calls
      const contracts = (tx.raw_data as Record<string, unknown>)?.contract as unknown[];
      if (!Array.isArray(contracts) || contracts.length === 0) return false;
      const type = (contracts[0] as Record<string, unknown>)?.type;
      return type === "TransferContract";
    })
    .map((tx) => {
      const contracts = (tx.raw_data as Record<string, unknown>).contract as Record<string, unknown>[];
      const val = (contracts[0] as Record<string, unknown>)?.parameter as Record<string, unknown>;
      const value = (val?.value as Record<string, unknown>)?.amount ?? 0;
      return {
        txHash:    (tx.txID ?? tx.transaction_id) as string,
        amount:    (Number(value) / 1_000_000).toFixed(6), // TRX has 6 decimals (sun)
        from:      ((val?.value as Record<string, unknown>)?.owner_address ?? "") as string,
        timestamp: Number(tx.block_timestamp),
        logIndex:  (tx.txID ?? tx.transaction_id) as string,
      };
    })
    .filter((tx) => Number(tx.amount) > 0);
  return opts.txHash ? txs.filter((tx) => tx.txHash === opts.txHash) : txs;
}

// ─── Bitcoin via Blockstream, with mempool.space fallback ─────────────────────
// Blockstream's free tier rate-limits our VPS IP (429 Too Many Requests), which
// silently dropped BTC deposit detection. Prefer Blockstream when healthy, else
// fall back to mempool.space (same Esplora-compatible JSON shape).

const BTC_EXPLORERS = [
  "https://blockstream.info/api",
  "https://mempool.space/api",
] as const;

// Litecoin has an Esplora-compatible API (identical JSON shape to Blockstream),
// so LTC reuses every parser below — only the base URL differs.
const LTC_EXPLORERS = [
  "https://litecoinspace.org/api",
] as const;

function btcDepositOutputs(address: string, tx: Record<string, unknown>, opts: { includeUnconfirmed?: boolean } = {}): DepositTx[] {
  const confirmed = Boolean((tx.status as Record<string, unknown>)?.confirmed);
  if (!confirmed && !opts.includeUnconfirmed) return [];
  const vout = tx.vout as Record<string, unknown>[] | undefined;
  if (!Array.isArray(vout)) return [];

  const firstInput = (tx.vin as Array<{ prevout?: { scriptpubkey_address?: string } }> | undefined)?.[0];
  const from = firstInput?.prevout?.scriptpubkey_address ?? "";
  const timestamp = Number((tx.status as Record<string, unknown>)?.block_time ?? Date.now() / 1000) * 1000;

  const results: DepositTx[] = [];
  vout.forEach((out, index) => {
    if (out.scriptpubkey_address !== address) return;
    const satoshis = Number(out.value ?? 0);
    if (satoshis <= 0) return;
    results.push({
      txHash:    tx.txid as string,
      amount:    (satoshis / 1e8).toFixed(8),
      from,
      timestamp,
      logIndex:  String(index),
      confirmed,
    });
  });
  return results;
}

async function fetchEsploraJson(bases: readonly string[], path: string): Promise<unknown | null> {
  for (const base of bases) {
    try {
      const res = await fetch(`${base}${path}`, { cache: "no-store" });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      // try next explorer
    }
  }
  return null;
}

const fetchBtcJson = (path: string) => fetchEsploraJson(BTC_EXPLORERS, path);

// Shared Esplora deposit scan — used by both BTC and LTC (same JSON shape).
async function checkEsploraDeposits(
  bases:   readonly string[],
  address: string,
  opts:    DepositCheckOptions = {},
): Promise<DepositTx[]> {
  if (opts.txHash) {
    const tx = await fetchEsploraJson(bases, `/tx/${opts.txHash}`);
    if (!tx || typeof tx !== "object") return [];
    // Recovery by hash should include unconfirmed so we can still notify.
    return btcDepositOutputs(address, tx as Record<string, unknown>, { includeUnconfirmed: true });
  }

  const txs = await fetchEsploraJson(bases, `/address/${address}/txs`);
  if (!Array.isArray(txs)) return [];

  const results: DepositTx[] = [];
  for (const tx of txs) {
    // Include mempool txs so cron can fire "Deposit detected" before confirmations.
    results.push(...btcDepositOutputs(address, tx as Record<string, unknown>, { includeUnconfirmed: true }));
  }
  return results;
}

export const checkBTCDeposits = (address: string, opts: DepositCheckOptions = {}) =>
  checkEsploraDeposits(BTC_EXPLORERS, address, opts);

export const checkLTCDeposits = (address: string, opts: DepositCheckOptions = {}) =>
  checkEsploraDeposits(LTC_EXPLORERS, address, opts);

// ─── Dogecoin via BlockCypher ─────────────────────────────────────────────────
// DOGE has no reliable public Esplora endpoint, so deposit detection uses the
// BlockCypher address API (different JSON shape). Values are koinu (1e8 = 1 DOGE).
// NOTE: unverified in-repo — smoke-test against real DOGE before flipping live.
const DOGE_API = process.env.DOGE_API ?? "https://api.blockcypher.com/v1/doge/main";
const BLOCKCYPHER_TOKEN = process.env.BLOCKCYPHER_TOKEN ?? "";

function dogeUrl(path: string): string {
  if (!BLOCKCYPHER_TOKEN) return `${DOGE_API}${path}`;
  return `${DOGE_API}${path}${path.includes("?") ? "&" : "?"}token=${BLOCKCYPHER_TOKEN}`;
}

interface BlockcypherRef {
  tx_hash: string;
  tx_output_n: number;
  value: number;
  confirmations?: number;
  confirmed?: string;
}

export async function checkDOGEDeposits(
  address: string,
  opts:    DepositCheckOptions = {},
): Promise<DepositTx[]> {
  const res = await fetch(dogeUrl(`/addrs/${address}?limit=50`), { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json() as { txrefs?: BlockcypherRef[]; unconfirmed_txrefs?: BlockcypherRef[] };
  const refs = [...(data.txrefs ?? []), ...(data.unconfirmed_txrefs ?? [])];

  const txs = refs
    .filter((r) => r.tx_output_n >= 0 && r.value > 0) // received outputs only (spends have tx_output_n = -1)
    .map((r) => {
      const parsed = r.confirmed ? Date.parse(r.confirmed) : NaN;
      return {
        txHash:    r.tx_hash,
        amount:    (r.value / 1e8).toFixed(8),
        from:      "",
        timestamp: Number.isNaN(parsed) ? Date.now() : parsed,
        logIndex:  String(r.tx_output_n),
        confirmed: (r.confirmations ?? 0) > 0,
      };
    });
  return opts.txHash ? txs.filter((t) => t.txHash === opts.txHash) : txs;
}

async function getDOGEBalance(address: string): Promise<number> {
  const res = await fetch(dogeUrl(`/addrs/${address}/balance`), { cache: "no-store" });
  if (!res.ok) return 0;
  const data = await res.json() as { final_balance?: number };
  return (data.final_balance ?? 0) / 1e8;
}

// ─── Unified dispatcher ───────────────────────────────────────────────────────

export async function checkDeposits(
  address: string,
  crypto:  string,
  network: string,
  opts: DepositCheckOptions = {},
): Promise<DepositTx[]> {
  if (network === "BITCOIN") return checkBTCDeposits(address, opts);
  if (network === "LITECOIN") return checkLTCDeposits(address, opts);
  if (network === "DOGECOIN") return checkDOGEDeposits(address, opts);
  if (network === "TRC20") {
    if (crypto === "TRX") return checkTronTRXDeposits(address, opts);
    return checkTronTRC20Deposits(address, crypto, opts);
  }
  return checkEVMDeposits(address, crypto, network, opts);
}

// ─── On-chain balance queries (for UI sync) ───────────────────────────────────
// Uses public RPC endpoints — no API key required, always reliable.

async function getEVMBalance(address: string, crypto: string, network: string): Promise<number> {
  const token = EVM_TOKENS[`${crypto}:${network}`];
  if (!token) return 0;

  if (!token.contract) {
    // Native coin — eth_getBalance
    const hex = await rpcRequest<string>(token.chainId, "eth_getBalance", [address, "latest"]);
    if (!hex) return 0;
    return Number(BigInt(hex)) / Math.pow(10, token.decimals);
  }

  // ERC-20 token — call balanceOf(address)
  const data = "0x70a08231" + address.slice(2).toLowerCase().padStart(64, "0");
  const hex  = await rpcRequest<string>(token.chainId, "eth_call", [{ to: token.contract, data }, "latest"]);
  if (!hex || hex === "0x") return 0;
  return Number(BigInt(hex)) / Math.pow(10, token.decimals);
}

async function getTRXBalance(address: string): Promise<number> {
  const apiKey  = process.env.TRONGRID_API_KEY;
  const headers: Record<string, string> = apiKey ? { "TRON-PRO-API-KEY": apiKey } : {};
  const res = await fetch(`${TRONGRID}/v1/accounts/${address}`, { headers, cache: "no-store" });
  const data = await res.json();
  return (data?.data?.[0]?.balance ?? 0) / 1_000_000;
}

async function getTRC20Balance(address: string, crypto: string): Promise<number> {
  const contract = TRC20_CONTRACTS[crypto];
  if (!contract) return 0;
  const apiKey  = process.env.TRONGRID_API_KEY;
  const headers: Record<string, string> = apiKey ? { "TRON-PRO-API-KEY": apiKey } : {};
  const res  = await fetch(`${TRONGRID}/v1/accounts/${address}`, { headers, cache: "no-store" });
  const data = await res.json();
  const trc20  = data?.data?.[0]?.trc20 ?? [];
  const token  = (trc20 as Record<string, string>[]).find((t) => Object.keys(t)[0] === contract);
  if (!token) return 0;
  return Number(Object.values(token)[0]) / 1_000_000;
}

async function getEsploraBalance(bases: readonly string[], address: string): Promise<number> {
  const data = await fetchEsploraJson(bases, `/address/${address}`);
  if (!data || typeof data !== "object") return 0;
  const stats = (data as { chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number } }).chain_stats;
  const funded = stats?.funded_txo_sum ?? 0;
  const spent  = stats?.spent_txo_sum  ?? 0;
  return (funded - spent) / 1e8;
}

const getBTCBalance = (address: string) => getEsploraBalance(BTC_EXPLORERS, address);
const getLTCBalance = (address: string) => getEsploraBalance(LTC_EXPLORERS, address);

/**
 * Returns the live on-chain balance, or `null` if the RPC/API call failed.
 * Prefer this for reconcile / clawbacks so an outage cannot zero ledgers.
 */
export async function tryGetOnChainBalance(
  address: string,
  crypto:  string,
  network: string,
): Promise<number | null> {
  try {
    let bal: number;
    if (network === "BITCOIN")            bal = await getBTCBalance(address);
    else if (network === "LITECOIN")      bal = await getLTCBalance(address);
    else if (network === "DOGECOIN")      bal = await getDOGEBalance(address);
    else if (network === "TRC20" && crypto === "TRX") bal = await getTRXBalance(address);
    else if (network === "TRC20")         bal = await getTRC20Balance(address, crypto);
    else                                  bal = await getEVMBalance(address, crypto, network);
    if (!Number.isFinite(bal) || bal < 0) return null;
    return bal;
  } catch {
    return null;
  }
}

/** Returns the actual current on-chain balance for an address/coin (0 on RPC failure). */
export async function getOnChainBalance(
  address: string,
  crypto:  string,
  network: string,
): Promise<number> {
  return (await tryGetOnChainBalance(address, crypto, network)) ?? 0;
}
