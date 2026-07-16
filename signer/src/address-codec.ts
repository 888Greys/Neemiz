/** Pure address encoders (copy of the web app's lib/crypto/address-codec.ts). */
import { createHash } from "crypto";
import { encodeCashAddr, decodeCashAddr } from "./cashaddr";

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

export function evmToTron(evm: string): string {
  const raw = Buffer.from("41" + evm.slice(2).toLowerCase(), "hex");
  const h1  = createHash("sha256").update(raw).digest();
  const h2  = createHash("sha256").update(h1).digest();
  return base58Encode(Buffer.concat([raw, h2.slice(0, 4)]));
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest();
const hash256 = (b: Buffer) => sha256(sha256(b));

/** secp256k1 compressed public key (hex, with/without 0x) → base58check P2PKH.
 *  `version`: 0x00 Bitcoin (1…), 0x30 Litecoin (L…). */
export function p2pkhFromPubKey(publicKeyHex: string, version = 0x00): string {
  const pubKey    = Buffer.from(publicKeyHex.replace(/^0x/, ""), "hex");
  const hash160   = createHash("ripemd160").update(sha256(pubKey)).digest();
  const versioned = Buffer.concat([Buffer.from([version]), hash160]);
  return base58Encode(Buffer.concat([versioned, hash256(versioned).subarray(0, 4)]));
}

export const btcP2PKHFromPubKey  = (publicKeyHex: string) => p2pkhFromPubKey(publicKeyHex, 0x00);
export const ltcP2PKHFromPubKey  = (publicKeyHex: string) => p2pkhFromPubKey(publicKeyHex, 0x30);
export const dogeP2PKHFromPubKey = (publicKeyHex: string) => p2pkhFromPubKey(publicKeyHex, 0x1e);

/** secp256k1 compressed public key → Bitcoin Cash CashAddr (bitcoincash:q…). */
export function bchP2PKHFromPubKey(publicKeyHex: string): string {
  const pubKey  = Buffer.from(publicKeyHex.replace(/^0x/, ""), "hex");
  const hash160 = createHash("ripemd160").update(sha256(pubKey)).digest();
  return encodeCashAddr(hash160);
}

export function base58Decode(s: string): Buffer {
  let num = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error(`Invalid base58 char: ${c}`);
    num = num * 58n + BigInt(i);
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const bytes = hex === "0" ? Buffer.alloc(0) : Buffer.from(hex, "hex");
  let leading = 0;
  for (const c of s) { if (c === "1") leading++; else break; }
  return Buffer.concat([Buffer.alloc(leading, 0), bytes]);
}

/**
 * base58check P2PKH address → its 20-byte hash160 (validates checksum + version).
 * `versions` lists the allowed P2PKH version bytes for the chain being spent.
 */
export function p2pkhToHash160(addr: string, versions: number[]): Buffer {
  const full = base58Decode(addr);
  if (full.length !== 25) throw new Error(`Bad address length: ${addr}`);
  const payload = full.subarray(0, 21);
  const chk     = full.subarray(21);
  if (!hash256(payload).subarray(0, 4).equals(chk)) throw new Error(`Bad address checksum: ${addr}`);
  if (!versions.includes(payload[0])) throw new Error(`Unsupported/wrong-network address: ${addr}`);
  return payload.subarray(1);
}

/** legacy P2PKH Bitcoin address (1…) → 20-byte hash160. */
export const btcAddressToHash160 = (addr: string) => p2pkhToHash160(addr, [0x00]);

/** legacy P2PKH Litecoin address (L…) → 20-byte hash160. */
export const ltcAddressToHash160 = (addr: string) => p2pkhToHash160(addr, [0x30]);

/** legacy P2PKH Dogecoin address (D…) → 20-byte hash160. */
export const dogeAddressToHash160 = (addr: string) => p2pkhToHash160(addr, [0x1e]);

/**
 * Bitcoin Cash destination → 20-byte hash160. Accepts CashAddr (bitcoincash:q…,
 * with or without prefix) and, as a fallback, legacy base58 P2PKH (version 0x00).
 */
export function bchAddressToHash160(addr: string): Buffer {
  if (/^(bitcoincash:)?[qp][a-z0-9]{40,}$/i.test(addr.trim())) {
    try { return decodeCashAddr(addr.trim()); } catch { /* fall through to legacy */ }
  }
  return p2pkhToHash160(addr.trim(), [0x00]);
}
