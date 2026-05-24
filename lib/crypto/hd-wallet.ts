/**
 * HD wallet address derivation for EVM (ETH / BSC) and Tron (TRC20).
 * Uses the MASTER_WALLET_MNEMONIC env var as the root seed.
 */
import { HDNodeWallet, Mnemonic } from "ethers";
import { createHash } from "crypto";
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

// ─── Address derivation ───────────────────────────────────────────────────────

function getRoot(): HDNodeWallet {
  const phrase = process.env.MASTER_WALLET_MNEMONIC;
  if (!phrase) throw new Error("MASTER_WALLET_MNEMONIC is not set");
  return HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(phrase));
}

/** Derives a checksummed EVM address (0x…). Works for ETH (ERC20) and BSC (BEP20). */
function deriveEVMAddress(index: number): string {
  return getRoot().derivePath(`m/44'/60'/0'/0/${index}`).address;
}

/** Converts an EVM 0x… address to a Tron T… address. */
function evmToTron(evm: string): string {
  const raw  = Buffer.from("41" + evm.slice(2).toLowerCase(), "hex"); // 21 bytes
  const h1   = createHash("sha256").update(raw).digest();
  const h2   = createHash("sha256").update(h1).digest();
  return base58Encode(Buffer.concat([raw, h2.slice(0, 4)]));
}

/** Derives a Tron T… address using the Tron derivation path m/44'/195'/… */
function deriveTronAddress(index: number): string {
  const child = getRoot().derivePath(`m/44'/195'/0'/0/${index}`);
  return evmToTron(child.address);
}

function deriveForNetwork(network: string, index: number): string {
  return network === "TRC20" ? deriveTronAddress(index) : deriveEVMAddress(index);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the existing deposit address for userId × crypto × network,
 * or derives and stores a new one if none exists yet.
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

  // Next derivation index for this network (global, so no two users share an address)
  const count = await db.cryptoDepositAddress.count({ where: { network } });
  const address = deriveForNetwork(network, count);

  await db.cryptoDepositAddress.create({
    data: { userId, crypto, network, address, derivationIndex: count },
  });

  return address;
}
