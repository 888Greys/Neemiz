/**
 * Deterministic deposit address derivation.
 * Uses HMAC-SHA256(MASTER_WALLET_MNEMONIC, userId:crypto:network) as a
 * private key, then derives the EVM/Tron address from it.
 *
 * No BIP39 mnemonic validation — the env var is used as a raw HMAC secret.
 * Same inputs always produce the same address, and addresses never collide
 * across different user × crypto × network combinations.
 */
import { Wallet } from "ethers";
import { createHash, createHmac } from "crypto";
import { db } from "@/lib/db";

// ─── Base58 encoder (for Tron addresses) ─────────────────────────────────────

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

/** Converts an EVM 0x… address to a Tron T… address. */
function evmToTron(evm: string): string {
  const raw = Buffer.from("41" + evm.slice(2).toLowerCase(), "hex"); // 21 bytes
  const h1  = createHash("sha256").update(raw).digest();
  const h2  = createHash("sha256").update(h1).digest();
  return base58Encode(Buffer.concat([raw, h2.slice(0, 4)]));
}

// ─── Key derivation ───────────────────────────────────────────────────────────

/**
 * Derives a deterministic 32-byte private key using HMAC-SHA256.
 * The MASTER_WALLET_MNEMONIC is used as the HMAC secret (raw string, no
 * BIP39 parsing), and `${userId}:${crypto}:${network}` as the message.
 */
function derivePrivateKey(userId: string, crypto: string, network: string): string {
  const secret = process.env.MASTER_WALLET_MNEMONIC;
  if (!secret) throw new Error("MASTER_WALLET_MNEMONIC is not set");
  const hex = createHmac("sha256", secret)
    .update(`${userId}:${crypto}:${network}`)
    .digest("hex");
  return "0x" + hex;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the existing deposit address for userId × crypto × network,
 * or derives and stores a new one deterministically.
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

  const privateKey = derivePrivateKey(userId, crypto, network);
  const wallet     = new Wallet(privateKey);
  const evmAddress = wallet.address; // checksummed 0x… EVM address

  const address = network === "TRC20" ? evmToTron(evmAddress) : evmAddress;

  await db.cryptoDepositAddress.create({
    data: { userId, crypto, network, address },
  });

  return address;
}
