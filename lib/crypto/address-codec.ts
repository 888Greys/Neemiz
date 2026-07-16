/**
 * Pure address encoders shared by the watch-only deriver (xpub.ts) and the
 * one-time migration script. No private keys, no seed — public-key → address
 * math only, so this is safe to run anywhere.
 */
import { createHash } from "crypto";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Encode(buf: Buffer): string {
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

/** EVM hex address (0x…) → Tron base58 (T…). */
export function evmToTron(evm: string): string {
  const raw = Buffer.from("41" + evm.slice(2).toLowerCase(), "hex");
  const h1  = createHash("sha256").update(raw).digest();
  const h2  = createHash("sha256").update(h1).digest();
  return base58Encode(Buffer.concat([raw, h2.slice(0, 4)]));
}

/**
 * secp256k1 public key (hex, with or without 0x) → base58check P2PKH address.
 * `version` is the network's P2PKH version byte: 0x00 Bitcoin (1…), 0x30 Litecoin (L…).
 */
export function p2pkhFromPubKey(publicKeyHex: string, version = 0x00): string {
  const pubKey   = Buffer.from(publicKeyHex.replace(/^0x/, ""), "hex");
  const sha      = createHash("sha256").update(pubKey).digest();
  const hash160  = createHash("ripemd160").update(sha).digest();
  const versioned = Buffer.concat([Buffer.from([version]), hash160]);
  const chk1 = createHash("sha256").update(versioned).digest();
  const chk2 = createHash("sha256").update(chk1).digest();
  return base58Encode(Buffer.concat([versioned, chk2.slice(0, 4)]));
}

/** secp256k1 public key → legacy P2PKH Bitcoin address (1…). */
export const btcP2PKHFromPubKey = (publicKeyHex: string) => p2pkhFromPubKey(publicKeyHex, 0x00);

/** secp256k1 public key → legacy P2PKH Litecoin address (L…). */
export const ltcP2PKHFromPubKey = (publicKeyHex: string) => p2pkhFromPubKey(publicKeyHex, 0x30);

/** secp256k1 public key → legacy P2PKH Dogecoin address (D…). */
export const dogeP2PKHFromPubKey = (publicKeyHex: string) => p2pkhFromPubKey(publicKeyHex, 0x1e);
