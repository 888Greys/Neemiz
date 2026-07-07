import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("wallet copy", () => {
  it("does not show the testing withdrawal-fee note", () => {
    const source = readFileSync("components/wallet-client.tsx", "utf8");

    expect(source).not.toContain("No Nezeem withdrawal fee during testing");
    expect(source).not.toContain("Nezeem pays the network gas separately");
  });
});
