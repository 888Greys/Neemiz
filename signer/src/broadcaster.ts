/**
 * On-chain broadcaster (runs on the signer host only).
 *
 * Signs a withdrawal directly from the user's own deposit address. Gas is
 * funded from the hot wallet (HD index 0) when the user's address is short on
 * native coin. Adapted from the web app's former lib/crypto/broadcaster.ts —
 * the only change is that the user's private key is resolved by HD index here,
 * via keys.ts, instead of from the database.
 */
import { ethers } from "ethers";
import { createHash } from "crypto";
import { getHotEVMKey, getHotTronKey, resolveUserKey } from "./keys";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function getTronTxId(tx: Record<string, unknown>): string {
  const provided = typeof tx.txID === "string" ? tx.txID : "";
  if (/^[0-9a-fA-F]{64}$/.test(provided)) return provided;
  const rawDataHex = typeof tx.raw_data_hex === "string" ? tx.raw_data_hex : "";
  if (!/^[0-9a-fA-F]+$/.test(rawDataHex) || rawDataHex.length % 2 !== 0) {
    throw new Error("TronGrid returned an invalid unsigned transaction");
  }
  return createHash("sha256").update(Buffer.from(rawDataHex, "hex")).digest("hex");
}

function base58Decode(str: string): Buffer {
  const digits = [0];
  for (let ci = 0; ci < str.length; ci++) {
    const idx = B58.indexOf(str[ci]);
    if (idx < 0) throw new Error(`Invalid base58 char: ${str[ci]}`);
    let carry = idx;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] * 58;
      digits[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) { digits.push(carry & 0xff); carry >>= 8; }
  }
  let leading = 0;
  for (let ci = 0; ci < str.length; ci++) { if (str[ci] === "1") leading++; else break; }
  const result = Buffer.alloc(leading + digits.length);
  digits.reverse().forEach((b, i) => { result[leading + i] = b; });
  return result;
}

function tronToHex(tron: string): string {
  const buf = base58Decode(tron);
  return "0x" + buf.subarray(1, 21).toString("hex");
}

// ─── Chain config ─────────────────────────────────────────────────────────────

const EVM_CHAINS: Record<string, { chainId: number; rpc: string }> = {
  ERC20:   { chainId: 1,   rpc: process.env.RPC_ERC20   ?? "https://ethereum-rpc.publicnode.com"    },
  BEP20:   { chainId: 56,  rpc: process.env.RPC_BEP20   ?? "https://bsc-rpc.publicnode.com"         },
  POLYGON: { chainId: 137, rpc: process.env.RPC_POLYGON ?? "https://polygon-bor-rpc.publicnode.com" },
};

const EVM_TOKENS: Record<string, string> = {
  "USDT:ERC20":   "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "USDT:BEP20":   "0x55d398326f99059fF775485246999027B3197955",
  "USDT:POLYGON": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  "USDC:ERC20":   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "USDC:POLYGON": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  "DAI:ERC20":    "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  "BUSD:BEP20":   "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  "WBTC:ERC20":   "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  "LINK:ERC20":   "0x514910771AF9Ca656af840dff83E8264EcF986CA",
};

const TOKEN_DECIMALS: Record<string, number> = { USDT: 6, USDC: 6, DAI: 18, BUSD: 18, WBTC: 8, LINK: 18 };

const MIN_GAS: Record<string, bigint> = {
  ERC20:   ethers.parseEther("0.003"),
  BEP20:   ethers.parseEther("0.002"),
  POLYGON: ethers.parseEther("0.005"),
};
const GAS_TOPUP: Record<string, bigint> = {
  ERC20:   ethers.parseEther("0.005"),
  BEP20:   ethers.parseEther("0.003"),
  POLYGON: ethers.parseEther("0.008"),
};

const ERC20_ABI = ["function transfer(address to, uint256 amount) returns (bool)"] as const;

// ─── EVM ──────────────────────────────────────────────────────────────────────

async function broadcastEVM(fromAddress: string, to: string, crypto: string, network: string, amount: number, userPrivKey: string): Promise<string> {
  const chain = EVM_CHAINS[network];
  if (!chain) throw new Error(`Unsupported EVM network: ${network}`);

  const provider   = new ethers.JsonRpcProvider(chain.rpc, chain.chainId);
  const userWallet = new ethers.Wallet(userPrivKey, provider);
  const hotWallet  = new ethers.Wallet(getHotEVMKey(), provider);
  const contractAddr = EVM_TOKENS[`${crypto}:${network}`];

  const gasBalance = await provider.getBalance(fromAddress);
  const minGas     = MIN_GAS[network] ?? ethers.parseEther("0.003");
  if (gasBalance < minGas) {
    const topUp = GAS_TOPUP[network] ?? ethers.parseEther("0.005");
    const gasTx = await hotWallet.sendTransaction({ to: fromAddress, value: topUp });
    await gasTx.wait();
  }

  if (!contractAddr) {
    const tx = await userWallet.sendTransaction({ to, value: ethers.parseEther(String(amount)) });
    const receipt = await tx.wait();
    if (!receipt) throw new Error("No receipt");
    return receipt.hash;
  }

  const decimals = TOKEN_DECIMALS[crypto] ?? 18;
  const contract = new ethers.Contract(contractAddr, ERC20_ABI, userWallet);
  const rawAmt   = BigInt(Math.round(amount * 10 ** decimals));
  const tx       = await (contract.transfer as (to: string, amount: bigint) => Promise<ethers.TransactionResponse>)(to, rawAmt);
  const receipt  = await tx.wait();
  if (!receipt) throw new Error("No receipt");
  return receipt.hash;
}

// ─── Tron ──────────────────────────────────────────────────────────────────────

const TRON_USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRONGRID           = "https://api.trongrid.io";

function trxToSun(value: string | undefined, fallback: number): number {
  const trx = Number(value ?? fallback);
  return Math.round((Number.isFinite(trx) ? Math.max(trx, 1) : fallback) * 1_000_000);
}
const MIN_TRX   = trxToSun(process.env.TRON_MIN_GAS_TRX, 15);
const TOPUP_TRX = trxToSun(process.env.TRON_GAS_TOPUP_TRX, 20);

function encodeTRC20Transfer(toHex: string, amount: bigint): string {
  const addr = toHex.slice(2).toLowerCase().padStart(64, "0");
  const amt  = amount.toString(16).padStart(64, "0");
  return addr + amt;
}

async function getTronNativeBalance(address: string, apiKey: string): Promise<number> {
  const headers: Record<string, string> = apiKey ? { "TRON-PRO-API-KEY": apiKey } : {};
  const res  = await fetch(`${TRONGRID}/v1/accounts/${address}`, { headers, cache: "no-store" });
  const data = await res.json() as { data?: Array<{ balance?: number }> };
  return data?.data?.[0]?.balance ?? 0;
}

async function sendTRXFromHotWallet(toTronAddress: string, sunAmount: number, apiKey: string): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(apiKey ? { "TRON-PRO-API-KEY": apiKey } : {}) };
  const hotKey     = getHotTronKey();
  const hotAddrEvm = new ethers.Wallet(hotKey).address;
  const hotTronHex = "41" + hotAddrEvm.slice(2).toLowerCase();
  const toHex      = "41" + tronToHex(toTronAddress).slice(2);

  const body = { owner_address: hotTronHex, to_address: toHex, amount: sunAmount, visible: false };
  const res  = await fetch(`${TRONGRID}/wallet/createtransaction`, { method: "POST", headers, body: JSON.stringify(body) });
  const tx   = await res.json() as Record<string, unknown>;

  const txID       = getTronTxId(tx);
  const signingKey = new ethers.SigningKey(hotKey);
  const sig        = signingKey.sign("0x" + txID);
  const tronSig    = sig.r.slice(2) + sig.s.slice(2) + (sig.v - 27).toString(16).padStart(2, "0");

  const signedTx  = { ...tx, signature: [tronSig] };
  const broadcast = await fetch(`${TRONGRID}/wallet/broadcasttransaction`, { method: "POST", headers, body: JSON.stringify(signedTx) });
  const result    = await broadcast.json() as { result?: boolean };
  if (!result.result) throw new Error("TRX top-up broadcast failed");
  await new Promise((r) => setTimeout(r, 3000));
}

async function broadcastTron(fromTronAddress: string, to: string, crypto: string, amount: number, userPrivKey: string): Promise<string> {
  if (crypto !== "USDT") throw new Error(`TRC20 ${crypto} not yet supported`);

  const apiKey  = process.env.TRONGRID_API_KEY ?? "";
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(apiKey ? { "TRON-PRO-API-KEY": apiKey } : {}) };

  const trxBalance = await getTronNativeBalance(fromTronAddress, apiKey);
  if (trxBalance < MIN_TRX) {
    await sendTRXFromHotWallet(fromTronAddress, TOPUP_TRX, apiKey);
  }

  const fromHex     = "41" + tronToHex(fromTronAddress).slice(2);
  const toHex       = "41" + tronToHex(to).slice(2);
  const contractHex = "41" + tronToHex(TRON_USDT_CONTRACT).slice(2);
  const rawAmount   = BigInt(Math.round(amount * 1_000_000));

  const body = {
    owner_address:     fromHex,
    contract_address:  contractHex,
    function_selector: "transfer(address,uint256)",
    parameter:         encodeTRC20Transfer("0x" + toHex.slice(2), rawAmount),
    fee_limit:         100_000_000,
    call_value:        0,
    visible:           false,
  };

  const triggerRes  = await fetch(`${TRONGRID}/wallet/triggersmartcontract`, { method: "POST", headers, body: JSON.stringify(body) });
  const triggerData = await triggerRes.json() as { result?: { result: boolean; message?: string }; transaction?: Record<string, unknown> };
  if (!triggerData?.result?.result) {
    throw new Error(`TronGrid trigger failed: ${triggerData?.result?.message ?? "unknown"}`);
  }

  const tx      = triggerData.transaction!;
  const txID    = getTronTxId(tx);
  const sig     = new ethers.SigningKey(userPrivKey).sign("0x" + txID);
  const tronSig = sig.r.slice(2) + sig.s.slice(2) + (sig.v - 27).toString(16).padStart(2, "0");

  const signedTx      = { ...tx, signature: [tronSig] };
  const broadcastRes  = await fetch(`${TRONGRID}/wallet/broadcasttransaction`, { method: "POST", headers, body: JSON.stringify(signedTx) });
  const broadcastData = await broadcastRes.json() as { result?: boolean; txid?: string; message?: string; code?: string };
  if (!broadcastData?.result) {
    throw new Error(`Tron broadcast failed: ${broadcastData?.message ?? broadcastData?.code ?? "unknown"}`);
  }
  return broadcastData.txid ?? txID;
}

// ─── Public dispatcher ──────────────────────────────────────────────────────

export interface BroadcastResult { txHash: string; network: string; explorer: string; }

export async function broadcastWithdrawal(input: {
  hdIndex: number | null;
  fromAddress: string;
  to: string;
  crypto: string;
  network: string;
  amount: number;
}): Promise<BroadcastResult> {
  const { hdIndex, fromAddress, to, crypto, network, amount } = input;
  const userPrivKey = resolveUserKey({ hdIndex, fromAddress, network });

  let txHash: string;
  if (network === "TRC20") {
    txHash = await broadcastTron(fromAddress, to, crypto, amount, userPrivKey);
  } else if (network === "BITCOIN") {
    throw new Error("BTC withdrawals not yet supported — coming soon");
  } else if (EVM_CHAINS[network]) {
    txHash = await broadcastEVM(fromAddress, to, crypto, network, amount, userPrivKey);
  } else {
    throw new Error(`Unsupported network: ${network}`);
  }

  const explorer =
    network === "TRC20"   ? `https://tronscan.org/#/transaction/${txHash}` :
    network === "BEP20"   ? `https://bscscan.com/tx/${txHash}` :
    network === "POLYGON" ? `https://polygonscan.com/tx/${txHash}` :
                            `https://etherscan.io/tx/${txHash}`;

  return { txHash, network, explorer };
}
