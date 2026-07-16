/**
 * Bitcoin Cash CashAddr codec (P2PKH only) — pure, dependency-free.
 * Implements the spec at https://github.com/bitcoincashorg/bitcoincash.org
 * (spec/cashaddr.md). Verifiable offline against the canonical test vector:
 *   hash160 76a04053bda0a88bda5177b86a15c3b29f559873
 *   → bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a
 *
 * BigInt is used via the constructor (not `123n` literals) because the app's
 * tsconfig targets below ES2020.
 */
const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const DEFAULT_PREFIX = "bitcoincash";

const MASK35 = BigInt("0x07ffffffff");
const FIVE = BigInt(5);
const GEN = [
  BigInt("0x98f2bc8e61"),
  BigInt("0x79b76d99e2"),
  BigInt("0xf33e5fb3c4"),
  BigInt("0xae2eabe2a8"),
  BigInt("0x1e4f43e470"),
];

function polymod(data: number[]): bigint {
  let c = BigInt(1);
  for (const d of data) {
    const c0 = c >> BigInt(35);
    c = ((c & MASK35) << FIVE) ^ BigInt(d);
    if (c0 & BigInt(1)) c ^= GEN[0];
    if (c0 & BigInt(2)) c ^= GEN[1];
    if (c0 & BigInt(4)) c ^= GEN[2];
    if (c0 & BigInt(8)) c ^= GEN[3];
    if (c0 & BigInt(16)) c ^= GEN[4];
  }
  return c ^ BigInt(1);
}

function prefixExpand(prefix: string): number[] {
  const out = prefix.split("").map((ch) => ch.charCodeAt(0) & 0x1f);
  out.push(0);
  return out;
}

function convertBits(data: number[], from: number, to: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << to) - 1;
  for (const value of data) {
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad && bits > 0) ret.push((acc << (to - bits)) & maxv);
  else if (!pad && (bits >= from || ((acc << (to - bits)) & maxv))) {
    throw new Error("Invalid padding in CashAddr payload");
  }
  return ret;
}

/** 20-byte P2PKH hash160 → CashAddr string ("bitcoincash:q…"). */
export function encodeCashAddr(hash160: Buffer, prefix = DEFAULT_PREFIX): string {
  if (hash160.length !== 20) throw new Error("CashAddr P2PKH requires a 20-byte hash160");
  const versionByte = 0x00; // type = P2PKH (0), size = 160-bit (0)
  const payload5 = convertBits([versionByte, ...hash160], 8, 5, true);
  const checksumInput = [...prefixExpand(prefix), ...payload5, 0, 0, 0, 0, 0, 0, 0, 0];
  const mod = polymod(checksumInput);
  const checksum: number[] = [];
  const mask = BigInt(0x1f);
  for (let i = 0; i < 8; i++) checksum.push(Number((mod >> BigInt(5 * (7 - i))) & mask));
  const body = [...payload5, ...checksum].map((b) => CHARSET[b]).join("");
  return `${prefix}:${body}`;
}

/** CashAddr string (with or without prefix) → 20-byte P2PKH hash160. Validates checksum. */
export function decodeCashAddr(addr: string): Buffer {
  const lower = addr.toLowerCase();
  const [prefix, body] = lower.includes(":") ? lower.split(":") : [DEFAULT_PREFIX, lower];
  const decoded: number[] = [];
  for (const ch of body) {
    const idx = CHARSET.indexOf(ch);
    if (idx < 0) throw new Error(`Invalid CashAddr character: ${ch}`);
    decoded.push(idx);
  }
  if (polymod([...prefixExpand(prefix), ...decoded]) !== BigInt(0)) {
    throw new Error(`Bad CashAddr checksum: ${addr}`);
  }
  const payload5 = decoded.slice(0, decoded.length - 8);
  const payload8 = convertBits(payload5, 5, 8, false);
  const versionByte = payload8[0];
  const type = (versionByte >> 3) & 0x0f;
  if (type !== 0) throw new Error(`Only P2PKH CashAddr is supported: ${addr}`);
  return Buffer.from(payload8.slice(1, 21));
}
