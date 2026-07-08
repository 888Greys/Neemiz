/** Pure address encoders (copy of the web app's lib/crypto/address-codec.ts). */
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

export function evmToTron(evm: string): string {
  const raw = Buffer.from("41" + evm.slice(2).toLowerCase(), "hex");
  const h1  = createHash("sha256").update(raw).digest();
  const h2  = createHash("sha256").update(h1).digest();
  return base58Encode(Buffer.concat([raw, h2.slice(0, 4)]));
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest();
const hash256 = (b: Buffer) => sha256(sha256(b));

/** secp256k1 compressed public key (hex, with/without 0x) → legacy P2PKH (1…). */
export function btcP2PKHFromPubKey(publicKeyHex: string): string {
  const pubKey    = Buffer.from(publicKeyHex.replace(/^0x/, ""), "hex");
  const hash160   = createHash("ripemd160").update(sha256(pubKey)).digest();
  const versioned = Buffer.concat([Buffer.from([0x00]), hash160]);
  return base58Encode(Buffer.concat([versioned, hash256(versioned).subarray(0, 4)]));
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

/** legacy P2PKH address (1…) → its 20-byte hash160 (validates the checksum). */
export function btcAddressToHash160(addr: string): Buffer {
  const full = base58Decode(addr);
  if (full.length !== 25) throw new Error(`Bad BTC address length: ${addr}`);
  const payload = full.subarray(0, 21);
  const chk     = full.subarray(21);
  if (!hash256(payload).subarray(0, 4).equals(chk)) throw new Error(`Bad BTC address checksum: ${addr}`);
  if (payload[0] !== 0x00) throw new Error(`Only legacy P2PKH (1…) addresses supported: ${addr}`);
  return payload.subarray(1);
}
