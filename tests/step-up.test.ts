import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.STEPUP_SECRET = "test-step-up-secret-value";
});

describe("withdrawal step-up token", () => {
  it("accepts a fresh token for the same user", async () => {
    const { mintStepUpToken, verifyStepUpToken } = await import("@/lib/step-up");
    const token = mintStepUpToken("user-123");
    expect(verifyStepUpToken(token, "user-123")).toBe(true);
  });

  it("rejects a token minted for a DIFFERENT user", async () => {
    const { mintStepUpToken, verifyStepUpToken } = await import("@/lib/step-up");
    const token = mintStepUpToken("user-123");
    expect(verifyStepUpToken(token, "attacker-999")).toBe(false);
  });

  it("rejects a missing/garbage token", async () => {
    const { verifyStepUpToken } = await import("@/lib/step-up");
    expect(verifyStepUpToken(undefined, "user-123")).toBe(false);
    expect(verifyStepUpToken("", "user-123")).toBe(false);
    expect(verifyStepUpToken("not|a|valid|token", "user-123")).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const { mintStepUpToken, verifyStepUpToken } = await import("@/lib/step-up");
    const token = mintStepUpToken("user-123");
    const parts = token.split("|");
    parts[3] = parts[3].slice(0, -1) + (parts[3].endsWith("A") ? "B" : "A");
    expect(verifyStepUpToken(parts.join("|"), "user-123")).toBe(false);
  });

  it("rejects an expired token", async () => {
    const { verifyStepUpToken } = await import("@/lib/step-up");
    const { createHmac } = await import("crypto");
    const uid = "user-123";
    const exp = Date.now() - 1000; // already expired
    const nonce = "abcdef012";
    const payload = `${uid}|${exp}|${nonce}`;
    const sig = createHmac("sha256", process.env.STEPUP_SECRET!).update(payload).digest("base64url");
    expect(verifyStepUpToken(`${payload}|${sig}`, uid)).toBe(false);
  });
});
