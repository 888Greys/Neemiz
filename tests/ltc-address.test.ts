import { describe, expect, it } from "vitest";
import { HDNodeWallet, Mnemonic } from "ethers";
import { btcP2PKHFromPubKey, ltcP2PKHFromPubKey, dogeP2PKHFromPubKey } from "@/lib/crypto/address-codec";

// LTC reuses the BTC secp256k1 key, re-encoded with Litecoin's P2PKH version
// byte (0x30 → "L…"). Same key → same hash160, different network prefix.
describe("Litecoin P2PKH address encoding", () => {
  // Derive a deterministic public key from a throwaway placeholder mnemonic
  // (no raw private key literal — keeps the secret-scanner hook happy).
  const pub = HDNodeWallet.fromMnemonic(
    Mnemonic.fromPhrase("test test test test test test test test test test test junk"),
    "m/44'/0'/0'/0/1",
  ).signingKey.compressedPublicKey;

  it("encodes Litecoin legacy addresses starting with 'L'", () => {
    const ltc = ltcP2PKHFromPubKey(pub);
    expect(ltc.startsWith("L")).toBe(true);
    expect(ltc.length).toBeGreaterThanOrEqual(26);
    expect(ltc.length).toBeLessThanOrEqual(34);
  });

  it("encodes Bitcoin legacy addresses starting with '1'", () => {
    expect(btcP2PKHFromPubKey(pub).startsWith("1")).toBe(true);
  });

  it("produces a different address than BTC for the same key", () => {
    expect(ltcP2PKHFromPubKey(pub)).not.toEqual(btcP2PKHFromPubKey(pub));
  });
});

// DOGE follows the same reuse pattern with version byte 0x1e → "D…".
describe("Dogecoin P2PKH address encoding", () => {
  const pub = HDNodeWallet.fromMnemonic(
    Mnemonic.fromPhrase("test test test test test test test test test test test junk"),
    "m/44'/0'/0'/0/1",
  ).signingKey.compressedPublicKey;

  it("encodes Dogecoin legacy addresses starting with 'D'", () => {
    expect(dogeP2PKHFromPubKey(pub).startsWith("D")).toBe(true);
  });

  it("differs from both BTC and LTC for the same key", () => {
    expect(dogeP2PKHFromPubKey(pub)).not.toEqual(btcP2PKHFromPubKey(pub));
    expect(dogeP2PKHFromPubKey(pub)).not.toEqual(ltcP2PKHFromPubKey(pub));
  });
});
