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

const EVM_TOKENS: Record<string, { chainId: number; contract: string }> = {
  // ── Ethereum (chainId 1) ──
  "ETH:ERC20":   { chainId: 1,   contract: "" },                                         // native
  "USDT:ERC20":  { chainId: 1,   contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
  "USDC:ERC20":  { chainId: 1,   contract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
  "DAI:ERC20":   { chainId: 1,   contract: "0x6B175474E89094C44Da98b954EedeAC495271d0F" },
  "WBTC:ERC20":  { chainId: 1,   contract: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" },
  "LINK:ERC20":  { chainId: 1,   contract: "0x514910771AF9Ca656af840dff83E8264EcF986CA" },
  // ── BSC (chainId 56) ──
  "BNB:BEP20":   { chainId: 56,  contract: "" },                                         // native
  "USDT:BEP20":  { chainId: 56,  contract: "0x55d398326f99059fF775485246999027B3197955" },
  "BUSD:BEP20":  { chainId: 56,  contract: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" },
  // ── Polygon (chainId 137) ──
  "MATIC:POLYGON": { chainId: 137, contract: "" },                                       // native
  "USDC:POLYGON":  { chainId: 137, contract: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" },
  "USDT:POLYGON":  { chainId: 137, contract: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
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

// ─── EVM (multi-chain) via Etherscan API V2 ───────────────────────────────────

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

// ─── Unified dispatcher ───────────────────────────────────────────────────────

export async function checkDeposits(
  address: string,
  crypto:  string,
  network: string,
): Promise<DepositTx[]> {
  if (network === "TRC20") {
    if (crypto === "TRX") return checkTronTRXDeposits(address);
    return checkTronTRC20Deposits(address, crypto); // USDT and any future TRC-20
  }
  return checkEVMDeposits(address, crypto, network);
}
