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
 * secp256k1 public key (hex) → base58check P2PKH address for any Bitcoin-family
 * chain. The only thing that varies between BTC/LTC/DOGE legacy addresses is the
 * one-byte version prefix; the hash160 + double-sha256 checksum are identical.
 */
export function p2pkhFromPubKey(publicKeyHex: string, version: number): string {
  const pubKey    = Buffer.from(publicKeyHex.replace(/^0x/, ""), "hex");
  const sha       = createHash("sha256").update(pubKey).digest();
  const hash160   = createHash("ripemd160").update(sha).digest();
  const versioned = Buffer.concat([Buffer.from([version]), hash160]);
  const chk1 = createHash("sha256").update(versioned).digest();
  const chk2 = createHash("sha256").update(chk1).digest();
  return base58Encode(Buffer.concat([versioned, chk2.slice(0, 4)]));
}

// Legacy P2PKH version bytes (BIP44 coin types differ from these — see xpub.ts).
export const P2PKH_VERSION = { BTC: 0x00, LTC: 0x30, DOGE: 0x1e } as const;

/** secp256k1 public key → legacy P2PKH Bitcoin address (1…). */
export function btcP2PKHFromPubKey(publicKeyHex: string): string {
  return p2pkhFromPubKey(publicKeyHex, P2PKH_VERSION.BTC);
}

/** secp256k1 public key → legacy P2PKH Litecoin address (L…). */
export function ltcP2PKHFromPubKey(publicKeyHex: string): string {
  return p2pkhFromPubKey(publicKeyHex, P2PKH_VERSION.LTC);
}

/** secp256k1 public key → legacy P2PKH Dogecoin address (D…). */
export function dogeP2PKHFromPubKey(publicKeyHex: string): string {
  return p2pkhFromPubKey(publicKeyHex, P2PKH_VERSION.DOGE);
}

// ── Bitcoin Cash CashAddr (bech32-style) ──────────────────────────────────────
// BCH legacy P2PKH shares BTC's 0x00 version byte, so it MUST use CashAddr to be
// unambiguous. Verified against the canonical spec vector (hash160 of
// 1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu → bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a).
const CASHADDR_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function cashaddrPolymod(data: number[]): bigint {
  const MASK = BigInt("0x07ffffffff");
  const GEN = [
    BigInt("0x98f2bc8e61"), BigInt("0x79b76d99e2"), BigInt("0xf33e5fb3c4"),
    BigInt("0xae2eabe2a8"), BigInt("0x1e4f43e470"),
  ];
  let c = BigInt(1);
  for (const d of data) {
    const c0 = Number(c >> BigInt(35));
    c = ((c & MASK) << BigInt(5)) ^ BigInt(d);
    for (let b = 0; b < 5; b++) if (c0 & (1 << b)) c ^= GEN[b];
  }
  return c ^ BigInt(1);
}

function cashaddrConvertBits(data: number[]): number[] {
  let acc = 0, bits = 0;
  const out: number[] = [];
  for (const v of data) {
    acc = ((acc << 8) | v) >>> 0;
    bits += 8;
    while (bits >= 5) { bits -= 5; out.push((acc >> bits) & 0x1f); }
  }
  if (bits > 0) out.push((acc << (5 - bits)) & 0x1f);
  return out;
}

/** secp256k1 public key → Bitcoin Cash CashAddr (bitcoincash:q…). P2PKH, version 0. */
export function bchCashAddrFromPubKey(publicKeyHex: string): string {
  const pubKey  = Buffer.from(publicKeyHex.replace(/^0x/, ""), "hex");
  const sha     = createHash("sha256").update(pubKey).digest();
  const hash160 = createHash("ripemd160").update(sha).digest();
  const payload5 = cashaddrConvertBits([0x00, ...hash160]); // versionByte 0x00 = P2PKH/160-bit
  const prefix   = "bitcoincash";
  const prefixExpand = [...prefix].map((ch) => ch.charCodeAt(0) & 0x1f);
  const mod = cashaddrPolymod([...prefixExpand, 0, ...payload5, 0, 0, 0, 0, 0, 0, 0, 0]);
  const checksum: number[] = [];
  for (let i = 0; i < 8; i++) checksum.push(Number((mod >> BigInt(5 * (7 - i))) & BigInt(0x1f)));
  return `${prefix}:${[...payload5, ...checksum].map((d) => CASHADDR_CHARSET[d]).join("")}`;
}
