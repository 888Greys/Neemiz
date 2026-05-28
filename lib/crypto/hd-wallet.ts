/**
 * HD wallet address derivation (BIP44).
 * MASTER_WALLET_MNEMONIC → unique address per user × crypto × network.
 *
 * Recovery: import the mnemonic into any BIP44 wallet (Exodus, Trust Wallet)
 * and iterate m/44'/60'/0'/0/N for EVM or m/44'/195'/0'/0/N for Tron.
 */
import { HDNodeWallet, Mnemonic } from "ethers";
import { createHash } from "crypto";
import { db } from "@/lib/db";

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
  // In ethers v6, fromMnemonic() defaults to m/44'/60'/0'/0/0 (depth 5).
  // We need the true root (depth 0) so we can derivePath("m/...") ourselves.
  const mnemonic = Mnemonic.fromPhrase(phrase.trim());
  return HDNodeWallet.fromSeed(mnemonic.computeSeed());
}

// ─── Address derivation ───────────────────────────────────────────────────────

function deriveEVMAddress(index: number): string {
  // BIP44 path for Ethereum — also used for BNB/BSC (same address format)
  return getRoot().derivePath(`m/44'/60'/0'/0/${index}`).address;
}

function deriveTronAddress(index: number): string {
  // BIP44 path for Tron (coin type 195)
  const child = getRoot().derivePath(`m/44'/195'/0'/0/${index}`);
  return evmToTron(child.address);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the existing deposit address for userId × crypto × network,
 * or derives and stores the next one using a global sequential index.
 *
 * Recovery: the Nth address (across all users/networks) lives at
 *   EVM  → m/44'/60'/0'/0/N
 *   Tron → m/44'/195'/0'/0/N
 */
export async function getOrCreateDepositAddress(
  userId:  string,
  crypto:  string,
  network: string,
): Promise<string> {
  const existing = await db.cryptoDepositAddress.findUnique({
    where: { userId_crypto_network: { userId, crypto, network } },
  });
  if (existing) return existing.address;

  const isTron = network === "TRC20";
  const isEvm  = !isTron; // ERC20, BEP20, POLYGON all share the same EVM address

  if (isEvm) {
    // Reuse an existing EVM address for this user across ERC20/BEP20/POLYGON
    const evmAddress = await db.cryptoDepositAddress.findFirst({
      where: { userId, network: { in: ["ERC20", "BEP20", "POLYGON"] } },
      orderBy: { createdAt: "asc" },
    });
    if (evmAddress) {
      await db.cryptoDepositAddress.create({
        data: { userId, crypto, network, address: evmAddress.address },
      });
      return evmAddress.address;
    }
  }

  // Global sequential index — each new user slot gets the next derivation index
  const index   = await db.cryptoDepositAddress.count();
  const address = isTron
    ? deriveTronAddress(index)
    : deriveEVMAddress(index);

  await db.cryptoDepositAddress.create({
    data: { userId, crypto, network, address },
  });

  return address;
}
