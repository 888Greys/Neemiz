/**
 * Self-custody crypto broadcaster.
 *
 * Withdrawals are signed DIRECTLY from the user's own deposit address.
 * The user's tokens are already on-chain at their address — no platform
 * token float needed.
 *
 * Gas model:
 *   - If the user's address already has enough native coin for gas → use it
 *   - If not → hot wallet (index 0) sends a tiny gas top-up first
 *     The gas cost is negligible ($0.001 on Polygon) and covered by the 5% fee.
 *
 * Hot wallet (index 0) only needs gas coins — NOT token float:
 *   Polygon: MATIC  |  Ethereum: ETH  |  BSC: BNB  |  Tron: TRX
 */

import { ethers, HDNodeWallet, Mnemonic } from "ethers";
import { createHash } from "crypto";
import { getPrivateKeyForAddress } from "./hd-wallet";

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

function tronToHex(tron: string): string {
  const buf = base58Decode(tron);
  return "0x" + buf.subarray(1, 21).toString("hex");
}

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

// ─── HD root + hot wallet ─────────────────────────────────────────────────────

function getRoot(): HDNodeWallet {
  const phrase = process.env.MASTER_WALLET_MNEMONIC;
  if (!phrase) throw new Error("MASTER_WALLET_MNEMONIC is not set");
  return HDNodeWallet.fromSeed(Mnemonic.fromPhrase(phrase.trim()).computeSeed());
}

function getHotEVMKey():  string { return getRoot().derivePath("m/44'/60'/0'/0/0").privateKey; }
function getHotTronKey(): string { return getRoot().derivePath("m/44'/195'/0'/0/0").privateKey; }

export function getHotWalletAddresses(): Record<string, string> {
  const evm = getRoot().derivePath("m/44'/60'/0'/0/0");
  return { EVM: evm.address, Tron: hexToTron(evm.address) };
}

// ─── Chain config ─────────────────────────────────────────────────────────────

const EVM_CHAINS: Record<string, { chainId: number; rpc: string }> = {
  ERC20:   { chainId: 1,   rpc: "https://ethereum-rpc.publicnode.com"    },
  BEP20:   { chainId: 56,  rpc: "https://bsc-rpc.publicnode.com"         },
  POLYGON: { chainId: 137, rpc: "https://polygon-bor-rpc.publicnode.com" },
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

const TOKEN_DECIMALS: Record<string, number> = {
  USDT: 6, USDC: 6, DAI: 18, BUSD: 18, WBTC: 8, LINK: 18,
};

// Minimum native gas balance before top-up is triggered
const MIN_GAS: Record<string, bigint> = {
  ERC20:   ethers.parseEther("0.003"),   // ETH
  BEP20:   ethers.parseEther("0.002"),   // BNB
  POLYGON: ethers.parseEther("0.005"),   // MATIC
};
// How much to top up (slightly above minimum for buffer)
const GAS_TOPUP: Record<string, bigint> = {
  ERC20:   ethers.parseEther("0.005"),
  BEP20:   ethers.parseEther("0.003"),
  POLYGON: ethers.parseEther("0.008"),
};

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
] as const;

// ─── EVM broadcaster (signs from user's own address) ─────────────────────────

async function broadcastEVM(
  fromAddress: string,  // user's deposit address (already has the tokens)
  to:          string,
  crypto:      string,
  network:     string,
  amount:      number,
): Promise<string> {
  const chain = EVM_CHAINS[network];
  if (!chain) throw new Error(`Unsupported EVM network: ${network}`);

  const provider      = new ethers.JsonRpcProvider(chain.rpc, chain.chainId);
  const userPrivKey   = await getPrivateKeyForAddress(fromAddress, network);
  const userWallet    = new ethers.Wallet(userPrivKey, provider);
  const hotWallet     = new ethers.Wallet(getHotEVMKey(), provider);

  const contractAddr = EVM_TOKENS[`${crypto}:${network}`];

  // ── Gas check & top-up ───────────────────────────────────────────────────
  const gasBalance = await provider.getBalance(fromAddress);
  const minGas     = MIN_GAS[network] ?? ethers.parseEther("0.003");

  if (gasBalance < minGas) {
    const topUp = GAS_TOPUP[network] ?? ethers.parseEther("0.005");
    console.log(`[broadcaster] Topping up gas for ${fromAddress}: sending ${ethers.formatEther(topUp)} native`);
    const gasTx = await hotWallet.sendTransaction({ to: fromAddress, value: topUp });
    await gasTx.wait(); // wait for gas to arrive before sending tokens
    console.log(`[broadcaster] Gas top-up confirmed: ${gasTx.hash}`);
  }

  // ── Send tokens from user's address ──────────────────────────────────────
  if (!contractAddr) {
    // Native coin (ETH/BNB/MATIC)
    const tx      = await userWallet.sendTransaction({ to, value: ethers.parseEther(String(amount)) });
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

// ─── Tron broadcaster (signs from user's own address) ────────────────────────

const TRON_USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRONGRID           = "https://api.trongrid.io";
const MIN_TRX            = 30_000_000;   // 30 TRX in sun
const TOPUP_TRX          = 50_000_000;   // 50 TRX

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
  const hotNode    = getRoot().derivePath("m/44'/195'/0'/0/0");
  const hotTronHex = "41" + hotNode.address.slice(2).toLowerCase();
  const toHex      = "41" + tronToHex(toTronAddress).slice(2);

  const body = { owner_address: hotTronHex, to_address: toHex, amount: sunAmount, visible: false };
  const res  = await fetch(`${TRONGRID}/wallet/createtransaction`, { method: "POST", headers, body: JSON.stringify(body) });
  const tx   = await res.json() as Record<string, unknown>;

  const txID = tx.txID as string;
  const signingKey = new ethers.SigningKey(getHotTronKey());
  const sig        = signingKey.sign("0x" + txID);
  const tronSig    = sig.r.slice(2) + sig.s.slice(2) + (sig.v - 27).toString(16).padStart(2, "0");

  const signedTx  = { ...tx, signature: [tronSig] };
  const broadcast = await fetch(`${TRONGRID}/wallet/broadcasttransaction`, {
    method: "POST", headers, body: JSON.stringify(signedTx),
  });
  const result = await broadcast.json() as { result?: boolean };
  if (!result.result) throw new Error("TRX top-up broadcast failed");
  // Small delay for confirmation
  await new Promise((r) => setTimeout(r, 3000));
}

async function broadcastTron(
  fromTronAddress: string,  // user's Tron deposit address
  to:              string,  // destination Tron address
  crypto:          string,
  amount:          number,
): Promise<string> {
  if (crypto !== "USDT") throw new Error(`TRC20 ${crypto} not yet supported`);

  const apiKey  = process.env.TRONGRID_API_KEY ?? "";
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(apiKey ? { "TRON-PRO-API-KEY": apiKey } : {}) };

  // ── TRX gas check & top-up ───────────────────────────────────────────────
  const trxBalance = await getTronNativeBalance(fromTronAddress, apiKey);
  if (trxBalance < MIN_TRX) {
    console.log(`[broadcaster] Topping up TRX for ${fromTronAddress}`);
    await sendTRXFromHotWallet(fromTronAddress, TOPUP_TRX, apiKey);
    console.log(`[broadcaster] TRX top-up done`);
  }

  // ── Sign from user's address ─────────────────────────────────────────────
  const userPrivKey = await getPrivateKeyForAddress(fromTronAddress, "TRC20");
  const userEVMNode = new ethers.Wallet(userPrivKey); // ethers wallet for signing
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

  const tx     = triggerData.transaction!;
  const txID   = tx.txID as string;
  const sig    = new ethers.SigningKey(userEVMNode.privateKey).sign("0x" + txID);
  const tronSig = sig.r.slice(2) + sig.s.slice(2) + (sig.v - 27).toString(16).padStart(2, "0");

  const signedTx       = { ...tx, signature: [tronSig] };
  const broadcastRes   = await fetch(`${TRONGRID}/wallet/broadcasttransaction`, { method: "POST", headers, body: JSON.stringify(signedTx) });
  const broadcastData  = await broadcastRes.json() as { result?: boolean; txid?: string; message?: string; code?: string };

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

/**
 * Sign and broadcast a withdrawal from the user's own deposit address.
 * fromAddress must exist in crypto_deposit_addresses.
 */
export async function broadcastWithdrawal(
  fromAddress: string,  // user's deposit address (tokens are already here)
  to:          string,  // user's external destination wallet
  crypto:      string,
  network:     string,
  amount:      number,
): Promise<BroadcastResult> {
  let txHash: string;

  if (network === "TRC20") {
    txHash = await broadcastTron(fromAddress, to, crypto, amount);
  } else if (network === "BITCOIN") {
    throw new Error("BTC withdrawals not yet supported — coming soon");
  } else if (EVM_CHAINS[network]) {
    txHash = await broadcastEVM(fromAddress, to, crypto, network, amount);
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
