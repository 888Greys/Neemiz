import { describe, expect, it } from "vitest";
import { encodeCashAddr, decodeCashAddr } from "@/lib/crypto/cashaddr";
import { bchP2PKHFromPubKey } from "@/lib/crypto/address-codec";
import { HDNodeWallet, Mnemonic } from "ethers";

describe("Bitcoin Cash CashAddr codec", () => {
  // Canonical vector from the CashAddr spec.
  const hash160 = Buffer.from("76a04053bda0a88bda5177b86a15c3b29f559873", "hex");
  const expected = "bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a";

  it("encodes the canonical spec vector", () => {
    expect(encodeCashAddr(hash160)).toBe(expected);
  });

  it("round-trips encode → decode back to the same hash160", () => {
    expect(decodeCashAddr(expected).toString("hex")).toBe(hash160.toString("hex"));
  });

  it("decodes with or without the prefix", () => {
    const noPrefix = expected.split(":")[1];
    expect(decodeCashAddr(noPrefix).toString("hex")).toBe(hash160.toString("hex"));
  });

  it("rejects a corrupted checksum", () => {
    const broken = expected.slice(0, -1) + (expected.endsWith("a") ? "z" : "a");
    expect(() => decodeCashAddr(broken)).toThrow();
  });

  it("derives a bitcoincash: address from a pubkey", () => {
    const pub = HDNodeWallet.fromMnemonic(
      Mnemonic.fromPhrase("test test test test test test test test test test test junk"),
      "m/44'/0'/0'/0/1",
    ).signingKey.compressedPublicKey;
    expect(bchP2PKHFromPubKey(pub).startsWith("bitcoincash:q")).toBe(true);
  });
});
