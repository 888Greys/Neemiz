/**
 * HD wallet address derivation (BIP44).
 * MASTER_WALLET_MNEMONIC → unique address per user × crypto × network.
 *
 * Recovery: import the mnemonic into any BIP44 wallet (Exodus, Trust Wallet)
 *   EVM  → m/44'/60'/0'/0/N
 *   Tron → m/44'/195'/0'/0/N
 *   BTC  → m/44'/0'/0'/0/N  (Legacy P2PKH — 1… addresses)
 *
 * Index 0 is the HOT WALLET (platform treasury / gas funder).
 * User addresses start at index 1+.
 */
import { HDNodeWallet, Mnemonic } from "ethers";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { registerMoralisEvmAddress } from "@/lib/crypto/moralis";
import { registerTatumAddress } from "@/lib/crypto/tatum";

// ─── Base58 encoder (for Tron T… addresses) ──────────────────────────────────

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

function evmToTron(evm: string): string {
  const raw = Buffer.from("41" + evm.slice(2).toLowerCase(), "hex");
  const h1  = createHash("sha256").update(raw).digest();
  const h2  = createHash("sha256").update(h1).digest();
  return base58Encode(Buffer.concat([raw, h2.slice(0, 4)]));
}

// ─── HD wallet root ───────────────────────────────────────────────────────────

function getRoot(): HDNodeWallet {
  const phrase = process.env.MASTER_WALLET_MNEMONIC;
  if (!phrase) throw new Error("MASTER_WALLET_MNEMONIC is not set");
  const mnemonic = Mnemonic.fromPhrase(phrase.trim());
  return HDNodeWallet.fromSeed(mnemonic.computeSeed());
}

// ─── Address + key derivation ─────────────────────────────────────────────────

function deriveEVM(index: number)  { return getRoot().derivePath(`m/44'/60'/0'/0/${index}`);  }
function deriveTron(index: number) { return getRoot().derivePath(`m/44'/195'/0'/0/${index}`); }
function deriveBTC(index: number)  { return getRoot().derivePath(`m/44'/0'/0'/0/${index}`);   }

function deriveEVMAddress(index: number):  string { return deriveEVM(index).address; }
function deriveTronAddress(index: number): string { return evmToTron(deriveTron(index).address); }

function deriveBTCAddress(index: number): string {
  const child  = deriveBTC(index);
  const pubKey = Buffer.from(child.publicKey.replace(/^0x/, ""), "hex");
  const sha    = createHash("sha256").update(pubKey).digest();
  const hash160 = createHash("ripemd160").update(sha).digest();
  const versioned = Buffer.concat([Buffer.from([0x00]), hash160]);
  const chk1 = createHash("sha256").update(versioned).digest();
  const chk2 = createHash("sha256").update(chk1).digest();
  return base58Encode(Buffer.concat([versioned, chk2.slice(0, 4)]));
}

// ─── Public: get private key for a stored address ────────────────────────────

/**
 * Given an address that exists in crypto_deposit_addresses, return its private key.
 * Uses the stored hdIndex for O(1) lookup; falls back to scanning 0–999 if null.
 */
export async function getPrivateKeyForAddress(
  address: string,
  network: string,
): Promise<string> {
  const row = await db.cryptoDepositAddress.findFirst({
    where: { address },
    select: { hdIndex: true },
  });

  if (row?.hdIndex != null) {
    return derivePrivateKeyAtIndex(row.hdIndex, network);
  }

  // Legacy addresses (created before hdIndex column) — scan to find
  const isTron = network === "TRC20";
  const isBTC  = network === "BITCOIN";
  const MAX    = 1000;

  for (let i = 0; i < MAX; i++) {
    const derived = isTron ? deriveTronAddress(i)
                   : isBTC  ? deriveBTCAddress(i)
                   :           deriveEVMAddress(i);

    if (derived.toLowerCase() === address.toLowerCase()) {
      // Back-fill the index so future lookups are instant
      await db.cryptoDepositAddress.updateMany({
        where: { address },
        data:  { hdIndex: i },
      }).catch(() => {});
      return derivePrivateKeyAtIndex(i, network);
    }
  }

  throw new Error(`Could not find HD index for address ${address}`);
}

function derivePrivateKeyAtIndex(index: number, network: string): string {
  if (network === "TRC20")   return deriveTron(index).privateKey;
  if (network === "BITCOIN") return deriveBTC(index).privateKey;
  return deriveEVM(index).privateKey;
}

async function registerRealtimeDepositAddress(address: string, network: string) {
  if (["ERC20", "BEP20", "POLYGON"].includes(network)) {
    const result = await registerMoralisEvmAddress(address);
    if (!result.ok && !result.skipped) {
      console.warn(`[moralis] failed to register ${address}: ${result.error ?? result.status}`);
    }
    return;
  }

  if (["BITCOIN", "TRC20"].includes(network)) {
    const result = await registerTatumAddress(address, network);
    if (!result.ok && !result.skipped) {
      console.warn(`[tatum] failed to register ${address}: ${result.error ?? result.status}`);
    }
  }
}

// ─── Public: create/get deposit address ──────────────────────────────────────

/**
 * Returns the existing deposit address for userId × crypto × network,
 * or derives and stores the next one using a global sequential index.
 * Stores the hdIndex so withdrawals can sign directly from this address.
 */
export async function getOrCreateDepositAddress(
  userId:  string,
  crypto:  string,
  network: string,
): Promise<string> {
  const existing = await db.cryptoDepositAddress.findUnique({
    where: { userId_crypto_network: { userId, crypto, network } },
  });
  if (existing) {
    await registerRealtimeDepositAddress(existing.address, network);
    return existing.address;
  }

  const isTron = network === "TRC20";
  const isBTC  = network === "BITCOIN";
  const isEvm  = !isTron && !isBTC;

  if (isEvm) {
    // Reuse the same EVM address for this user across ERC20/BEP20/POLYGON
    const evmRow = await db.cryptoDepositAddress.findFirst({
      where: { userId, network: { in: ["ERC20", "BEP20", "POLYGON"] } },
      orderBy: { createdAt: "asc" },
    });
    if (evmRow) {
      await db.cryptoDepositAddress.create({
        data: { userId, crypto, network, address: evmRow.address, hdIndex: evmRow.hdIndex },
      });
      await registerRealtimeDepositAddress(evmRow.address, network);
      return evmRow.address;
    }
  }

  // New slot — use count as next index (index 0 is reserved for hot wallet)
  // Add 1 so user addresses start at 1+
  const index   = (await db.cryptoDepositAddress.count()) + 1;
  const address = isTron ? deriveTronAddress(index)
                : isBTC  ? deriveBTCAddress(index)
                :           deriveEVMAddress(index);

  await db.cryptoDepositAddress.create({
    data: { userId, crypto, network, address, hdIndex: index },
  });

  await registerRealtimeDepositAddress(address, network);
  return address;
}
