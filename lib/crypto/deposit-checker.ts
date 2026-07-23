/**
 * On-chain deposit checking via Etherscan API V2 (multi-chain) and TronGrid (Tron).
 * Supported:
 *   EVM chains — Ethereum (1), BSC (56), Polygon (137)
 *   Tron       — TRC-20 tokens + native TRX
 */

import { createHash } from "crypto";
import { EVM_TOKENS } from "@/lib/crypto/token-registry";

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
  /** Wider historical scan for any EVM token chain (catch-up after an outage). */
  backfill?:      boolean;
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
  // EVM TOKEN deposits (USDT/USDC/… on Polygon, BSC, Ethereum) — detected via
  // public-RPC eth_getLogs / eth_getTransactionReceipt, NOT the Etherscan key
  // (its hard daily cap once exhausted silently stopped crediting every EVM
  // deposit platform-wide).
  if (token.contract) {
    return checkBscTokenDeposits(address, crypto, network, {
      backfill: opts.backfillBep20 ?? opts.backfill,
      txHash:   opts.txHash,
    });
  }

  // NATIVE EVM coins (ETH/BNB/POL, no contract) emit no logs and public RPC has
  // no txs-by-address method, so they are NOT scanned here. They are credited in
  // real time by Moralis (webhook) and reconciled by the balance-diff backstop
  // (lib/crypto/native-evm-reconcile). This keeps the deposit-checker 100%
  // Etherscan-free.
  return [];
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

async function fetchBtcJson(path: string): Promise<unknown | null> {
  for (const base of BTC_EXPLORERS) {
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

async function checkBTCDepositByHash(address: string, txHash: string): Promise<DepositTx[]> {
  const tx = await fetchBtcJson(`/tx/${txHash}`);
  if (!tx || typeof tx !== "object") return [];
  // Recovery by hash should include unconfirmed so we can still notify.
  return btcDepositOutputs(address, tx as Record<string, unknown>, { includeUnconfirmed: true });
}

export async function checkBTCDeposits(
  address: string,
  opts:    DepositCheckOptions = {},
): Promise<DepositTx[]> {
  if (opts.txHash) return checkBTCDepositByHash(address, opts.txHash);

  const txs = await fetchBtcJson(`/address/${address}/txs`);
  if (!Array.isArray(txs)) return [];

  const results: DepositTx[] = [];
  for (const tx of txs) {
    // Include mempool txs so cron can fire "Deposit detected" before confirmations.
    results.push(...btcDepositOutputs(address, tx as Record<string, unknown>, { includeUnconfirmed: true }));
  }
  return results;
}

// ─── Unified dispatcher ───────────────────────────────────────────────────────

export async function checkDeposits(
  address: string,
  crypto:  string,
  network: string,
  opts: DepositCheckOptions = {},
): Promise<DepositTx[]> {
  if (network === "BITCOIN") return checkBTCDeposits(address, opts);
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

const TRONSCAN_API = "https://apilist.tronscanapi.com";

// Fetch a Tron account from TronGrid. Returns the account object, or null when
// the response is unusable (error / rate-limit / malformed / EMPTY data array).
// CRITICAL: an empty `data: []` is treated as UNKNOWN (null), NOT balance 0 —
// TronGrid returns empty for funded addresses under load, and a false 0 made the
// reconcile claw back real deposits (goodhope's 28.6 TRX, 2026-07-22).
async function tronGridAccount(address: string): Promise<Record<string, unknown> | null> {
  const apiKey  = process.env.TRONGRID_API_KEY;
  const headers: Record<string, string> = apiKey ? { "TRON-PRO-API-KEY": apiKey } : {};
  try {
    const res = await fetch(`${TRONGRID}/v1/accounts/${address}`, { headers, cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.Error || !Array.isArray(data?.data) || data.data.length === 0) return null;
    return data.data[0] as Record<string, unknown>;
  } catch { return null; }
}

async function tronscanAccount(address: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${TRONSCAN_API}/api/account?address=${address}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch { return null; }
}

async function getTRXBalance(address: string): Promise<number> {
  const acct = await tronGridAccount(address);
  if (acct) return Number(acct.balance ?? 0) / 1_000_000;
  // TronGrid unusable — cross-check Tronscan (authoritative) before giving up.
  const ts = await tronscanAccount(address);
  if (ts) return Number(ts.balance ?? 0) / 1_000_000;
  // Both sources failed: THROW so tryGetOnChainBalance returns null and the
  // reconcile SKIPS — never clamp a ledger to a guessed 0.
  throw new Error(`TRX balance unavailable for ${address}`);
}

async function getTRC20Balance(address: string, crypto: string): Promise<number> {
  const contract = TRC20_CONTRACTS[crypto];
  if (!contract) return 0;
  const acct = await tronGridAccount(address);
  if (!acct) {
    // TronGrid unusable — cross-check Tronscan's TRC20 balances.
    const res = await fetch(`${TRONSCAN_API}/api/account/tokens?address=${address}&type=trc20`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) {
      const data = await res.json().catch(() => null) as { data?: Array<{ tokenId?: string; balance?: string; tokenDecimal?: number }> } | null;
      const tok = data?.data?.find((t) => t.tokenId === contract);
      if (data) return tok ? Number(tok.balance) / 10 ** (tok.tokenDecimal ?? 6) : 0;
    }
    throw new Error(`TRC20 balance unavailable for ${address} (${crypto})`);
  }
  const trc20 = (acct.trc20 as Record<string, string>[] | undefined) ?? [];
  const token = trc20.find((t) => Object.keys(t)[0] === contract);
  if (!token) return 0;
  return Number(Object.values(token)[0]) / 1_000_000;
}

async function getBTCBalance(address: string): Promise<number> {
  const data = await fetchBtcJson(`/address/${address}`);
  if (!data || typeof data !== "object") return 0;
  const stats = (data as { chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number } }).chain_stats;
  const funded = stats?.funded_txo_sum ?? 0;
  const spent  = stats?.spent_txo_sum  ?? 0;
  return (funded - spent) / 1e8;
}

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
