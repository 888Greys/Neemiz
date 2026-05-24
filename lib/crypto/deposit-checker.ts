/**
 * On-chain deposit checking via Etherscan API V2 (ETH + BSC) and TronGrid (Tron).
 */

const ETHERSCAN = "https://api.etherscan.io/v2/api";
const TRONGRID  = "https://api.trongrid.io";

// ERC-20 / BEP-20 token contracts (empty contract = native coin)
const EVM_TOKENS: Record<string, { chainId: number; contract: string }> = {
  "USDT:ERC20": { chainId: 1,  contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
  "USDT:BEP20": { chainId: 56, contract: "0x55d398326f99059fF775485246999027B3197955" },
  "ETH:ERC20":  { chainId: 1,  contract: "" }, // native ETH
  "BNB:BEP20":  { chainId: 56, contract: "" }, // native BNB
};

// TRC-20 USDT contract on Tron mainnet
const TRON_USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export interface DepositTx {
  txHash:    string;
  amount:    string; // human-readable, e.g. "100.000000"
  from:      string;
  timestamp: number; // ms
}

// ─── EVM (ETH / BSC) via Etherscan API V2 ────────────────────────────────────

export async function checkEVMDeposits(
  address: string,
  crypto:  string,
  network: string,
): Promise<DepositTx[]> {
  const token = EVM_TOKENS[`${crypto}:${network}`];
  if (!token) return [];

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
    // Native ETH / BNB: use normal transaction list
    url.searchParams.set("action", "txlist");
  } else {
    // ERC-20 / BEP-20 token transfer
    url.searchParams.set("action",          "tokentx");
    url.searchParams.set("contractaddress", token.contract);
  }

  const res  = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  if (data.status !== "1" || !Array.isArray(data.result)) return [];

  if (isNative) {
    // txlist: filter successful inbound txs, value in wei (18 decimals)
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

  // tokentx: ERC-20 / BEP-20
  return (data.result as Record<string, string>[])
    .filter((tx) => tx.to?.toLowerCase() === address.toLowerCase())
    .map((tx) => ({
      txHash:    tx.hash,
      amount:    (Number(tx.value) / 10 ** Number(tx.tokenDecimal)).toFixed(6),
      from:      tx.from,
      timestamp: Number(tx.timeStamp) * 1000,
    }));
}

// ─── Tron (TRC20 USDT) via TronGrid ──────────────────────────────────────────

export async function checkTronUSDTDeposits(address: string): Promise<DepositTx[]> {
  const apiKey  = process.env.TRONGRID_API_KEY;
  const headers: Record<string, string> = apiKey
    ? { "TRON-PRO-API-KEY": apiKey }
    : {};

  const url = `${TRONGRID}/v1/accounts/${address}/transactions/trc20` +
    `?contract_address=${TRON_USDT}&only_confirmed=true&limit=20`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data.data)) return [];

  return (data.data as Record<string, unknown>[])
    .filter((tx) => {
      const info = tx.token_info as Record<string, unknown> | undefined;
      return tx.to === address && info?.symbol === "USDT";
    })
    .map((tx) => ({
      txHash:    tx.transaction_id as string,
      amount:    (Number(tx.value) / 1_000_000).toFixed(6), // 6 decimals
      from:      tx.from as string,
      timestamp: Number(tx.block_timestamp),
    }));
}

// ─── Unified checker ──────────────────────────────────────────────────────────

export async function checkDeposits(
  address: string,
  crypto:  string,
  network: string,
): Promise<DepositTx[]> {
  if (network === "TRC20" && crypto === "USDT") {
    return checkTronUSDTDeposits(address);
  }
  return checkEVMDeposits(address, crypto, network);
}
