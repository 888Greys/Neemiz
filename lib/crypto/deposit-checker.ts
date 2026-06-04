/**
 * On-chain deposit checking via Etherscan API V2 (multi-chain) and TronGrid (Tron).
 * Supported:
 *   EVM chains — Ethereum (1), BSC (56), Polygon (137)
 *   Tron       — TRC-20 tokens + native TRX
 */

const ETHERSCAN = "https://api.etherscan.io/v2/api";
const TRONGRID  = "https://api.trongrid.io";

// ─── EVM token registry ───────────────────────────────────────────────────────
// chainId 1 = Ethereum, 56 = BSC, 137 = Polygon
// Empty contract string = native coin (ETH, BNB, MATIC)

const EVM_TOKENS: Record<string, { chainId: number; contract: string; decimals: number }> = {
  // ── Ethereum (chainId 1) ──
  "ETH:ERC20":   { chainId: 1,   contract: "", decimals: 18 },                                         // native
  "USDT:ERC20":  { chainId: 1,   contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
  "USDC:ERC20":  { chainId: 1,   contract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  "DAI:ERC20":   { chainId: 1,   contract: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
  "WBTC:ERC20":  { chainId: 1,   contract: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
  "LINK:ERC20":  { chainId: 1,   contract: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18 },
  // ── BSC (chainId 56) ──
  "BNB:BEP20":   { chainId: 56,  contract: "", decimals: 18 },                                         // native
  "USDT:BEP20":  { chainId: 56,  contract: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
  "BUSD:BEP20":  { chainId: 56,  contract: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", decimals: 18 },
  // ── Polygon (chainId 137) ──
  "MATIC:POLYGON": { chainId: 137, contract: "", decimals: 18 },                                       // native
  // Native USDC on Polygon (0x3c499c...) — Binance and most exchanges send this
  // USDC.e (bridged, 0x2791...) is legacy; kept as fallback key
  "USDC:POLYGON":  { chainId: 137, contract: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
  "USDCE:POLYGON": { chainId: 137, contract: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6 },
  "USDT:POLYGON":  { chainId: 137, contract: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
};

// ─── Tron TRC-20 token contracts ──────────────────────────────────────────────
const TRC20_CONTRACTS: Record<string, string> = {
  USDT: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
};

export interface DepositTx {
  txHash:    string;
  amount:    string; // human-readable, e.g. "100.000000"
  from:      string;
  timestamp: number; // ms
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
}>> {
  const logs = await rpcRequest<Array<{
    blockNumber: string;
    data: string;
    topics: string[];
    transactionHash: string;
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
      }));
  }

  return (data.result as Record<string, string>[])
    .filter((tx) => tx.to?.toLowerCase() === address.toLowerCase())
    .map((tx) => ({
      txHash:    tx.hash,
      amount:    (Number(tx.value) / 10 ** Number(tx.tokenDecimal)).toFixed(6),
      from:      tx.from,
      timestamp: Number(tx.timeStamp) * 1000,
    }));
}

// ─── Tron TRC-20 tokens via TronGrid ─────────────────────────────────────────

export async function checkTronTRC20Deposits(
  address:  string,
  crypto:   string,
): Promise<DepositTx[]> {
  const contract = TRC20_CONTRACTS[crypto];
  if (!contract) return [];

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
    }));
}

// ─── Tron native TRX via TronGrid ────────────────────────────────────────────

export async function checkTronTRXDeposits(address: string): Promise<DepositTx[]> {
  const apiKey  = process.env.TRONGRID_API_KEY;
  const headers: Record<string, string> = apiKey ? { "TRON-PRO-API-KEY": apiKey } : {};

  const url = `${TRONGRID}/v1/accounts/${address}/transactions` +
    `?only_confirmed=true&only_to=true&limit=20`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data.data)) return [];

  return (data.data as Record<string, unknown>[])
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
      };
    })
    .filter((tx) => Number(tx.amount) > 0);
}

// ─── Bitcoin via Blockstream API (free, no key) ───────────────────────────────

export async function checkBTCDeposits(address: string): Promise<DepositTx[]> {
  const url = `https://blockstream.info/api/address/${address}/txs`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const txs = await res.json() as Record<string, unknown>[];
  if (!Array.isArray(txs)) return [];

  const results: DepositTx[] = [];
  for (const tx of txs) {
    if (!(tx.status as Record<string, unknown>)?.confirmed) continue; // skip unconfirmed
    const vout = tx.vout as Record<string, unknown>[] | undefined;
    if (!Array.isArray(vout)) continue;
    for (const out of vout) {
      if (out.scriptpubkey_address !== address) continue;
      const satoshis = Number(out.value ?? 0);
      if (satoshis <= 0) continue;
      results.push({
        txHash:    tx.txid as string,
        amount:    (satoshis / 1e8).toFixed(8),
        from:      "", // Blockstream doesn't give input address easily
        timestamp: Number((tx.status as Record<string, unknown>)?.block_time ?? 0) * 1000,
      });
    }
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
  if (network === "BITCOIN") return checkBTCDeposits(address);
  if (network === "TRC20") {
    if (crypto === "TRX") return checkTronTRXDeposits(address);
    return checkTronTRC20Deposits(address, crypto);
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

async function getBTCBalance(address: string): Promise<number> {
  const res  = await fetch(`https://blockstream.info/api/address/${address}`, { cache: "no-store" });
  if (!res.ok) return 0;
  const data = await res.json();
  const funded = data?.chain_stats?.funded_txo_sum ?? 0;
  const spent  = data?.chain_stats?.spent_txo_sum  ?? 0;
  return (funded - spent) / 1e8;
}

/** Returns the actual current on-chain balance for an address/coin. */
export async function getOnChainBalance(
  address: string,
  crypto:  string,
  network: string,
): Promise<number> {
  try {
    if (network === "BITCOIN")            return await getBTCBalance(address);
    if (network === "TRC20" && crypto === "TRX") return await getTRXBalance(address);
    if (network === "TRC20")              return await getTRC20Balance(address, crypto);
    return await getEVMBalance(address, crypto, network);
  } catch {
    return 0; // never throw — balance sync is best-effort
  }
}
