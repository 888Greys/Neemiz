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
import { btcAddressToHash160, ltcAddressToHash160, dogeAddressToHash160, bchAddressToHash160 } from "./address-codec";

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

/**
 * Send native TRX (a TransferContract) from `fromTronAddress` to `to`, signed
 * with `privKey`. Self-paying: the network fee (bandwidth, or a tiny TRX burn)
 * comes out of the sender's own TRX — no separate gas token or hot-wallet
 * top-up, unlike a TRC-20 token transfer. Same recipe as sendTRXFromHotWallet.
 */
async function sendNativeTRX(fromTronAddress: string, to: string, sunAmount: number, privKey: string, apiKey: string): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(apiKey ? { "TRON-PRO-API-KEY": apiKey } : {}) };
  const fromHex = "41" + tronToHex(fromTronAddress).slice(2);
  const toHex   = "41" + tronToHex(to).slice(2);

  const body = { owner_address: fromHex, to_address: toHex, amount: sunAmount, visible: false };
  const res  = await fetch(`${TRONGRID}/wallet/createtransaction`, { method: "POST", headers, body: JSON.stringify(body) });
  const tx   = await res.json() as Record<string, unknown> & { Error?: string };
  if (tx.Error) throw new Error(`TRX createtransaction failed: ${tx.Error}`);

  const txID    = getTronTxId(tx);
  const sig     = new ethers.SigningKey(privKey).sign("0x" + txID);
  const tronSig = sig.r.slice(2) + sig.s.slice(2) + (sig.v - 27).toString(16).padStart(2, "0");

  const signedTx      = { ...tx, signature: [tronSig] };
  const broadcastRes  = await fetch(`${TRONGRID}/wallet/broadcasttransaction`, { method: "POST", headers, body: JSON.stringify(signedTx) });
  const broadcastData = await broadcastRes.json() as { result?: boolean; txid?: string; message?: string; code?: string };
  if (!broadcastData?.result) throw new Error(`Tron broadcast failed: ${broadcastData?.message ?? broadcastData?.code ?? "unknown"}`);
  return broadcastData.txid ?? txID;
}

async function broadcastTron(fromTronAddress: string, to: string, crypto: string, amount: number, userPrivKey: string): Promise<string> {
  const apiKey  = process.env.TRONGRID_API_KEY ?? "";

  // Native TRX withdrawal — self-paying, no TRC-20 contract call, no gas top-up.
  if (crypto === "TRX") {
    return sendNativeTRX(fromTronAddress, to, Math.round(amount * 1_000_000), userPrivKey, apiKey);
  }
  if (crypto !== "USDT") throw new Error(`TRC20 ${crypto} not yet supported`);

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

// ─── Bitcoin (legacy P2PKH) ─────────────────────────────────────────────────
//
// Spends the user's own BTC UTXOs to the destination, change back to the same
// address. Unlike EVM/TRON there is NO hot-wallet gas top-up: the miner fee is
// paid out of the BTC being moved. Signing is pure secp256k1 (ethers SigningKey)
// + manual sighash/DER, so the signer needs no extra Bitcoin dependency.

const BTC_API  = process.env.BTC_API  ?? "https://blockstream.info/api";
const LTC_API  = process.env.LTC_API  ?? "https://litecoinspace.org/api";
const DOGE_API = process.env.DOGE_API ?? "https://api.blockcypher.com/v1/doge/main";
const BCH_API  = process.env.BCH_API  ?? "https://api.blockchair.com/bitcoin-cash";
const BLOCKCYPHER_TOKEN = process.env.BLOCKCYPHER_TOKEN ?? "";
const BLOCKCHAIR_KEY    = process.env.BLOCKCHAIR_KEY ?? "";

interface Utxo { txid: string; vout: number; value: number; }

// A UTXO transaction is built + signed identically for every legacy-P2PKH,
// secp256k1, 1e8-base-unit chain (BTC/LTC/DOGE). Only three things differ per
// chain: where to read UTXOs / fee / broadcast (the provider), how to decode an
// address (version byte), and the dust threshold.
interface UtxoProvider {
  listUtxos(address: string): Promise<Utxo[]>;
  feeRateSatPerVb(): Promise<number>;
  broadcastHex(hex: string): Promise<string>; // returns txid
}
interface UtxoChain {
  addressToHash160: (addr: string) => Buffer;
  explorer: (txid: string) => string;
  provider: UtxoProvider;
  dust: number;
  // "legacy" = original Bitcoin sighash (BTC/LTC/DOGE); "bip143" = BCH's
  // BIP143 preimage with SIGHASH_FORKID (0x41). Only the sighash + hashtype byte
  // differ — the serialized tx format is identical.
  sighash: "legacy" | "bip143";
}

async function esploraFetch<T>(api: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${api}${path}`, init);
  if (!res.ok) throw new Error(`UTXO API ${path} -> HTTP ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

// Esplora / Blockstream-shape API (BTC via blockstream+mempool, LTC via litecoinspace).
function esploraProvider(api: string): UtxoProvider {
  return {
    listUtxos: (addr) => esploraFetch<Utxo[]>(api, `/address/${addr}/utxo`),
    feeRateSatPerVb: async () => {
      const fe = await esploraFetch<Record<string, number>>(api, `/fee-estimates`);
      return Math.max(Math.ceil(fe["2"] ?? fe["3"] ?? 2), 2);
    },
    broadcastHex: async (hex) => esploraFetch<string>(api, `/tx`, { method: "POST", body: hex }),
  };
}

// BlockCypher-shape API (Dogecoin has no reliable public Esplora endpoint).
// NOTE: unverified in-repo — must be smoke-tested against real DOGE before going
// live. Values are koinu (1e8 = 1 DOGE), same base unit as satoshis.
function blockcypherProvider(base: string, token: string): UtxoProvider {
  const q = token ? `token=${token}` : "";
  const withQ = (path: string) => `${base}${path}${q ? (path.includes("?") ? `&${q}` : `?${q}`) : ""}`;
  return {
    listUtxos: async (addr) => {
      const res = await fetch(withQ(`/addrs/${addr}?unspentOnly=true&limit=2000`));
      if (!res.ok) throw new Error(`DOGE API /addrs -> HTTP ${res.status}`);
      const data = await res.json() as { txrefs?: { tx_hash: string; tx_output_n: number; value: number }[] };
      return (data.txrefs ?? [])
        .filter((r) => r.tx_output_n >= 0 && r.value > 0)
        .map((r) => ({ txid: r.tx_hash, vout: r.tx_output_n, value: r.value }));
    },
    feeRateSatPerVb: async () => {
      const res = await fetch(withQ(``));
      if (!res.ok) throw new Error(`DOGE API / -> HTTP ${res.status}`);
      const data = await res.json() as { medium_fee_per_kb?: number };
      const perKb = data.medium_fee_per_kb ?? 1_000_000; // koinu/kB (min relay ≈ 0.01 DOGE/kB)
      return Math.max(Math.ceil(perKb / 1000), 1000);     // koinu/vByte, floored at min relay
    },
    broadcastHex: async (hex) => {
      const res  = await fetch(withQ(`/txs/push`), {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tx: hex }),
      });
      const data = await res.json() as { tx?: { hash?: string }; error?: string; errors?: { error: string }[] };
      const hash = data.tx?.hash;
      if (!hash) throw new Error(`DOGE broadcast failed: ${data.error ?? data.errors?.[0]?.error ?? "unknown"}`);
      return hash;
    },
  };
}

// Blockchair-shape API (Bitcoin Cash). Values in satoshis. Unverified in-repo —
// smoke-test against real BCH before going live.
function blockchairProvider(base: string, key: string): UtxoProvider {
  const q = key ? `?key=${key}` : "";
  const stripPrefix = (a: string) => a.replace(/^bitcoincash:/i, "");
  return {
    listUtxos: async (addr) => {
      const res = await fetch(`${base}/dashboards/address/${stripPrefix(addr)}${q}`);
      if (!res.ok) throw new Error(`BCH API /dashboards -> HTTP ${res.status}`);
      const data = await res.json() as { data?: Record<string, { utxo?: { transaction_hash: string; index: number; value: number }[] }> };
      const entry = data.data?.[stripPrefix(addr)] ?? Object.values(data.data ?? {})[0];
      return (entry?.utxo ?? []).map((u) => ({ txid: u.transaction_hash, vout: u.index, value: u.value }));
    },
    feeRateSatPerVb: async () => {
      const res = await fetch(`${base}/stats${q}`);
      if (!res.ok) throw new Error(`BCH API /stats -> HTTP ${res.status}`);
      const data = await res.json() as { data?: { suggested_transaction_fee_per_byte_sat?: number } };
      return Math.max(Math.ceil(data.data?.suggested_transaction_fee_per_byte_sat ?? 1), 1);
    },
    broadcastHex: async (hex) => {
      const res  = await fetch(`${base}/push/transaction${q}`, {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    `data=${hex}`,
      });
      const data = await res.json() as { data?: { transaction_hash?: string }; context?: { error?: string } };
      const hash = data.data?.transaction_hash;
      if (!hash) throw new Error(`BCH broadcast failed: ${data.context?.error ?? "unknown"}`);
      return hash;
    },
  };
}

const UTXO_CHAINS: Record<string, UtxoChain> = {
  BITCOIN:     { addressToHash160: btcAddressToHash160,  explorer: (t) => `https://mempool.space/tx/${t}`,     provider: esploraProvider(BTC_API),                        dust: 546,       sighash: "legacy" },
  LITECOIN:    { addressToHash160: ltcAddressToHash160,  explorer: (t) => `https://litecoinspace.org/tx/${t}`, provider: esploraProvider(LTC_API),                        dust: 546,       sighash: "legacy" },
  DOGECOIN:    { addressToHash160: dogeAddressToHash160, explorer: (t) => `https://dogechain.info/tx/${t}`,    provider: blockcypherProvider(DOGE_API, BLOCKCYPHER_TOKEN), dust: 1_000_000, sighash: "legacy" },
  BITCOINCASH: { addressToHash160: bchAddressToHash160,  explorer: (t) => `https://blockchair.com/bitcoin-cash/transaction/${t}`, provider: blockchairProvider(BCH_API, BLOCKCHAIR_KEY), dust: 546, sighash: "bip143" },
};

const btcSha256d = (b: Buffer) => createHash("sha256").update(createHash("sha256").update(b).digest()).digest();
const u32le = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
const u64le = (n: bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(n); return b; };
function varint(n: number): Buffer {
  if (n < 0xfd) return Buffer.from([n]);
  if (n <= 0xffff) { const b = Buffer.alloc(3); b[0] = 0xfd; b.writeUInt16LE(n, 1); return b; }
  const b = Buffer.alloc(5); b[0] = 0xfe; b.writeUInt32LE(n, 1); return b;
}
function p2pkhScript(hash160: Buffer): Buffer {
  return Buffer.concat([Buffer.from([0x76, 0xa9, 0x14]), hash160, Buffer.from([0x88, 0xac])]);
}
function derInt(buf: Buffer): Buffer {
  let b = Buffer.from(buf); let i = 0;
  while (i < b.length - 1 && b[i] === 0) i++;
  b = b.subarray(i);
  if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]);
  return Buffer.concat([Buffer.from([0x02, b.length]), b]);
}
function derSig(rHex: string, sHex: string): Buffer {
  const body = Buffer.concat([
    derInt(Buffer.from(rHex.replace(/^0x/, ""), "hex")),
    derInt(Buffer.from(sHex.replace(/^0x/, ""), "hex")),
  ]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

// Serialize the tx; when `scriptForInput` is set (index >= 0) that input carries
// the prevout script (for sighash), all others are empty — legacy SIGHASH_ALL.
function serializeBtcTx(
  inputs: Utxo[],
  outputs: { script: Buffer; value: bigint }[],
  scripts: (Buffer | null)[],
): Buffer {
  const parts: Buffer[] = [u32le(1), varint(inputs.length)];
  inputs.forEach((inp, i) => {
    const script = scripts[i] ?? Buffer.alloc(0);
    parts.push(
      Buffer.from(inp.txid, "hex").reverse(), u32le(inp.vout),
      varint(script.length), script, u32le(0xffffffff),
    );
  });
  parts.push(varint(outputs.length));
  outputs.forEach((o) => parts.push(u64le(o.value), varint(o.script.length), o.script));
  parts.push(u32le(0));
  return Buffer.concat(parts);
}

// BIP143 sighash preimage (used by Bitcoin Cash with SIGHASH_FORKID). Every input
// shares hashPrevouts/hashSequence/hashOutputs; only outpoint+scriptCode+value vary.
// forkId = 0 on BCH mainnet, so the 4-byte sighash type is just `hashType` (0x41).
function bip143Sighashes(inputs: Utxo[], outputs: { script: Buffer; value: bigint }[], prevoutScript: Buffer, hashType: number): Buffer[] {
  const hashPrevouts = btcSha256d(Buffer.concat(inputs.map((i) => Buffer.concat([Buffer.from(i.txid, "hex").reverse(), u32le(i.vout)]))));
  const hashSequence = btcSha256d(Buffer.concat(inputs.map(() => u32le(0xffffffff))));
  const hashOutputs  = btcSha256d(Buffer.concat(outputs.map((o) => Buffer.concat([u64le(o.value), varint(o.script.length), o.script]))));
  return inputs.map((inp) => {
    const preimage = Buffer.concat([
      u32le(1),                                                     // nVersion
      hashPrevouts,
      hashSequence,
      Buffer.from(inp.txid, "hex").reverse(), u32le(inp.vout),      // this input's outpoint
      varint(prevoutScript.length), prevoutScript,                 // scriptCode (prevout P2PKH)
      u64le(BigInt(inp.value)),                                    // prevout value
      u32le(0xffffffff),                                           // nSequence
      hashOutputs,
      u32le(0),                                                    // nLocktime
      u32le(hashType),                                             // sighash type (forkId=0)
    ]);
    return btcSha256d(preimage);
  });
}

// Spend a legacy-P2PKH UTXO chain (BTC / LTC / DOGE / BCH). Self-paying: the miner fee
// is paid out of the coin being moved — no hot-wallet gas top-up. Identical tx
// construction across chains; `chain` carries the provider, address decoder, dust.
async function broadcastUTXO(chain: UtxoChain, fromAddress: string, to: string, amountCoin: number, userPrivKey: string): Promise<string> {
  const { provider, addressToHash160, dust } = chain;
  const sendSats = BigInt(Math.round(amountCoin * 1e8));
  if (sendSats <= BigInt(dust)) throw new Error("Amount below dust");

  const utxos = (await provider.listUtxos(fromAddress))
    .filter((u) => u.value > 0)
    .sort((a, b) => b.value - a.value);
  if (utxos.length === 0) throw new Error("No spendable UTXOs at deposit address");

  const feeRate = await provider.feeRateSatPerVb();

  const fromH160 = addressToHash160(fromAddress);
  const toScript = p2pkhScript(addressToHash160(to));
  const fromScript = p2pkhScript(fromH160);
  const compressedPub = Buffer.from(new ethers.SigningKey(userPrivKey).compressedPublicKey.slice(2), "hex");

  // Greedily add inputs until value covers send + fee. Legacy sizes: ~148 vB per
  // input, 34 vB per output, ~10 vB overhead. Assume 2 outputs (dest + change).
  const chosen: Utxo[] = [];
  let inValue = 0n;
  let fee = 0n;
  let sendMinusFee = false;
  for (const u of utxos) {
    chosen.push(u); inValue += BigInt(u.value);
    const vbytes = chosen.length * 148 + 2 * 34 + 10;
    fee = BigInt(feeRate * vbytes);
    if (inValue >= sendSats + fee) break;
  }
  let outValue = sendSats;
  let change = inValue - sendSats - fee;
  if (change < 0n) {
    // Can't cover fee on top — take it out of the amount (max-send), 1 output.
    const vbytes = chosen.length * 148 + 34 + 10;
    fee = BigInt(feeRate * vbytes);
    outValue = inValue - fee;
    change = 0n;
    sendMinusFee = true;
    if (outValue <= BigInt(dust)) throw new Error("Balance too low to cover network fee");
  }

  const outputs = [{ script: toScript, value: outValue }];
  if (!sendMinusFee && change > BigInt(dust)) outputs.push({ script: fromScript, value: change });

  // Per-input sighash digest + hashtype byte differ by chain: legacy Bitcoin
  // sighash (0x01) for BTC/LTC/DOGE, BIP143 + SIGHASH_FORKID (0x41) for BCH.
  const bip143 = chain.sighash === "bip143";
  const hashTypeByte = bip143 ? 0x41 : 0x01;
  const digests = bip143
    ? bip143Sighashes(chosen, outputs, fromScript, hashTypeByte)
    : chosen.map((_, idx) => {
        const scripts = chosen.map((__, j) => (j === idx ? fromScript : null));
        return btcSha256d(Buffer.concat([serializeBtcTx(chosen, outputs, scripts), u32le(hashTypeByte)]));
      });

  const signingKey = new ethers.SigningKey(userPrivKey);
  const scriptSigs: Buffer[] = digests.map((digest) => {
    const sig = signingKey.sign(digest);
    const der = derSig(sig.r, sig.s);
    return Buffer.concat([
      varint(der.length + 1), der, Buffer.from([hashTypeByte]),
      varint(compressedPub.length), compressedPub,
    ]);
  });

  const finalTx = serializeBtcTx(chosen, outputs, scriptSigs).toString("hex");
  const txid = await provider.broadcastHex(finalTx);
  if (!/^[0-9a-f]{64}$/.test(txid)) throw new Error(`Broadcast failed: ${txid}`);
  return txid;
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

  const utxoChain = UTXO_CHAINS[network];

  let txHash: string;
  if (network === "TRC20") {
    txHash = await broadcastTron(fromAddress, to, crypto, amount, userPrivKey);
  } else if (utxoChain) {
    txHash = await broadcastUTXO(utxoChain, fromAddress, to, amount, userPrivKey);
  } else if (EVM_CHAINS[network]) {
    txHash = await broadcastEVM(fromAddress, to, crypto, network, amount, userPrivKey);
  } else {
    throw new Error(`Unsupported network: ${network}`);
  }

  const explorer =
    network === "TRC20"   ? `https://tronscan.org/#/transaction/${txHash}` :
    utxoChain             ? utxoChain.explorer(txHash) :
    network === "BEP20"   ? `https://bscscan.com/tx/${txHash}` :
    network === "POLYGON" ? `https://polygonscan.com/tx/${txHash}` :
                            `https://etherscan.io/tx/${txHash}`;

  return { txHash, network, explorer };
}
