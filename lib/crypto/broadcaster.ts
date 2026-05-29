/**
 * Self-custody crypto broadcaster.
 *
 * All outgoing withdrawals are signed by the HOT WALLET — the EVM/Tron/BTC
 * address at derivation index 0 of the master HD seed.  The hot wallet must
 * be funded with native gas coins and the tokens users want to withdraw.
 *
 * To see hot wallet addresses, call getHotWalletAddresses().
 *
 * Supported chains:
 *   EVM (Ethereum, BSC, Polygon) → ethers v6 + public RPC
 *   Tron                         → TronGrid HTTP API + ethers secp256k1
 *   Bitcoin                      → not yet supported
 */

import { ethers, HDNodeWallet, Mnemonic } from "ethers";
import { createHash } from "crypto";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

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

/** Tron base58check address → 0x hex (EVM format, 20 bytes). */
function tronToHex(tron: string): string {
  const buf = base58Decode(tron);            // 25 bytes: 1 version + 20 addr + 4 checksum
  return "0x" + buf.subarray(1, 21).toString("hex");
}

/** 0x hex EVM address → Tron base58check address. */
function hexToTron(hex: string): string {
  const raw  = Buffer.from("41" + hex.slice(2).toLowerCase(), "hex");
  const h1   = createHash("sha256").update(raw).digest();
  const h2   = createHash("sha256").update(h1).digest();
  const full = Buffer.concat([raw, h2.subarray(0, 4)]);
  const digits: number[] = [0];
  for (let bi = 0; bi < full.length; bi++) {
    let carry = full[bi];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry) { digits.push(carry % 58); carry = Math.floor(carry / 58); }
  }
  let leading = 0;
  for (let bi = 0; bi < full.length; bi++) { if (full[bi] === 0) leading++; else break; }
  return "1".repeat(leading) + digits.reverse().map((d) => B58[d]).join("");
}

// ─── HD root ──────────────────────────────────────────────────────────────────

function getRoot(): HDNodeWallet {
  const phrase = process.env.MASTER_WALLET_MNEMONIC;
  if (!phrase) throw new Error("MASTER_WALLET_MNEMONIC is not set");
  return HDNodeWallet.fromSeed(Mnemonic.fromPhrase(phrase.trim()).computeSeed());
}

function getHotEVMPrivateKey(): string {
  return getRoot().derivePath("m/44'/60'/0'/0/0").privateKey;
}

function getHotTronPrivateKey(): string {
  return getRoot().derivePath("m/44'/195'/0'/0/0").privateKey;
}

/** Returns the hot wallet addresses so you know where to send funds. */
export function getHotWalletAddresses(): Record<string, string> {
  const root    = getRoot();
  const evmNode = root.derivePath("m/44'/60'/0'/0/0");
  return {
    EVM:  evmNode.address,   // Ethereum / BSC / Polygon — same address
    Tron: hexToTron(evmNode.address),
  };
}

// ─── EVM chain config ─────────────────────────────────────────────────────────

const EVM_CHAINS: Record<string, { chainId: number; rpc: string }> = {
  ERC20:   { chainId: 1,   rpc: "https://ethereum-rpc.publicnode.com"  },
  BEP20:   { chainId: 56,  rpc: "https://bsc-rpc.publicnode.com"       },
  POLYGON: { chainId: 137, rpc: "https://polygon-bor-rpc.publicnode.com" },
};

const EVM_TOKENS: Record<string, string> = {
  // key = "SYMBOL:network"
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

// Decimals for ERC20 tokens (default 18; stablecoins use 6)
const TOKEN_DECIMALS: Record<string, number> = {
  USDT: 6, USDC: 6, DAI: 18, BUSD: 18, WBTC: 8, LINK: 18,
};

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
] as const;

// ─── EVM broadcaster ──────────────────────────────────────────────────────────

async function broadcastEVM(
  to:      string,
  crypto:  string,
  network: string,
  amount:  number,
): Promise<string> {
  const chain = EVM_CHAINS[network];
  if (!chain) throw new Error(`Unsupported EVM network: ${network}`);

  const provider = new ethers.JsonRpcProvider(chain.rpc, chain.chainId);
  const wallet   = new ethers.Wallet(getHotEVMPrivateKey(), provider);

  const contractAddr = EVM_TOKENS[`${crypto}:${network}`];

  if (!contractAddr) {
    // Native coin (ETH on ERC20, BNB on BEP20, MATIC on POLYGON)
    const tx = await wallet.sendTransaction({
      to,
      value: ethers.parseEther(String(amount)),
    });
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Transaction failed — no receipt");
    return receipt.hash;
  }

  // ERC-20 token transfer
  const decimals = TOKEN_DECIMALS[crypto] ?? 18;
  const contract = new ethers.Contract(contractAddr, ERC20_ABI, wallet);
  const rawAmt   = BigInt(Math.round(amount * 10 ** decimals));
  const tx       = await (contract.transfer as (to: string, amount: bigint) => Promise<ethers.TransactionResponse>)(to, rawAmt);
  const receipt  = await tx.wait();
  if (!receipt) throw new Error("Transaction failed — no receipt");
  return receipt.hash;
}

// ─── Tron broadcaster ─────────────────────────────────────────────────────────

const TRON_USDT_CONTRACT  = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRONGRID            = "https://api.trongrid.io";

/** Encode `transfer(address, uint256)` parameters for Tron smart contract call. */
function encodeTRC20Transfer(toHex: string, amount: bigint): string {
  // ABI encoding: 32-byte padded address + 32-byte padded uint256
  const addr = toHex.slice(2).toLowerCase().padStart(64, "0");
  const amt  = amount.toString(16).padStart(64, "0");
  return addr + amt;
}

async function broadcastTron(
  to:     string,  // base58 Tron address
  crypto: string,
  amount: number,
): Promise<string> {
  const contractB58 = TRON_USDT_CONTRACT; // extend for other TRC20 tokens as needed
  if (crypto !== "USDT") throw new Error(`TRC20 ${crypto} not yet supported`);

  const apiKey     = process.env.TRONGRID_API_KEY ?? "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(apiKey ? { "TRON-PRO-API-KEY": apiKey } : {}),
  };

  // Get hot wallet Tron address + hex forms
  const hotEVMKey     = getHotTronPrivateKey();
  const hotEVMNode    = getRoot().derivePath("m/44'/195'/0'/0/0");
  const hotTronAddr   = hexToTron(hotEVMNode.address);
  const hotTronHex    = "41" + hotEVMNode.address.slice(2).toLowerCase();

  // Recipient hex
  const toHex = "41" + tronToHex(to).slice(2).toLowerCase();

  // Raw amount in USDT (6 decimals)
  const rawAmount = BigInt(Math.round(amount * 1_000_000));

  // 1. Build unsigned transaction via TronGrid
  const body = {
    owner_address:     hotTronHex,
    contract_address:  "41" + tronToHex(contractB58).slice(2),
    function_selector: "transfer(address,uint256)",
    parameter:         encodeTRC20Transfer("0x" + toHex.slice(2), rawAmount),
    fee_limit:         100_000_000,  // 100 TRX max fee
    call_value:        0,
    visible:           false,
  };

  const triggerRes = await fetch(`${TRONGRID}/wallet/triggersmartcontract`, {
    method: "POST", headers, body: JSON.stringify(body),
  });
  const triggerData = await triggerRes.json() as { result?: { result: boolean; message?: string }; transaction?: Record<string, unknown> };

  if (!triggerData?.result?.result) {
    throw new Error(`TronGrid trigger failed: ${triggerData?.result?.message ?? "unknown"}`);
  }
  const tx = triggerData.transaction!;
  const txID = tx.txID as string;

  // 2. Sign txID with secp256k1 (no Ethereum prefix — raw sign)
  const signingKey = new ethers.SigningKey(hotEVMKey);
  const sig        = signingKey.sign("0x" + txID);
  // Tron signature format: r + s + v (where v = sig.v - 27, i.e. 0 or 1)
  const tronSig = sig.r.slice(2) + sig.s.slice(2) + (sig.v - 27).toString(16).padStart(2, "0");

  // 3. Add signature and broadcast
  const signedTx = { ...tx, signature: [tronSig] };
  const broadcastRes = await fetch(`${TRONGRID}/wallet/broadcasttransaction`, {
    method: "POST", headers, body: JSON.stringify(signedTx),
  });
  const broadcastData = await broadcastRes.json() as { result?: boolean; code?: string; message?: string; txid?: string };

  if (!broadcastData?.result) {
    throw new Error(`Tron broadcast failed: ${broadcastData?.message ?? broadcastData?.code ?? "unknown"}`);
  }

  return broadcastData.txid ?? txID;
}

// ─── Public dispatcher ────────────────────────────────────────────────────────

export interface BroadcastResult {
  txHash:   string;
  network:  string;
  explorer: string;
}

export async function broadcastWithdrawal(
  to:      string,   // destination address
  crypto:  string,   // "USDT", "USDC", "ETH", "BNB", "MATIC" ...
  network: string,   // "TRC20", "ERC20", "BEP20", "POLYGON", "BITCOIN"
  amount:  number,   // human-readable
): Promise<BroadcastResult> {
  let txHash: string;

  if (network === "TRC20") {
    txHash = await broadcastTron(to, crypto, amount);
  } else if (network === "BITCOIN") {
    throw new Error("BTC withdrawals not yet supported — coming soon");
  } else if (EVM_CHAINS[network]) {
    txHash = await broadcastEVM(to, crypto, network, amount);
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
