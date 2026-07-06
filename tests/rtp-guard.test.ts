import { describe, it, expect } from "vitest";
import { evaluateKind } from "@/lib/binary/rtp-guard";

describe("evaluateKind (runtime RTP guard threshold)", () => {
  const MIN = 200, HALT = 1.10;

  it("breaches when RTP > threshold AND sample is large enough", () => {
    const r = evaluateKind({ count: 300, staked: 1000, paid: 1200 }, MIN, HALT); // 120%
    expect(r.rtp).toBeCloseTo(1.2, 5);
    expect(r.breach).toBe(true);
  });

  it("does NOT breach on small samples even if RTP is high (noise protection)", () => {
    const r = evaluateKind({ count: 20, staked: 100, paid: 300 }, MIN, HALT); // 300% but tiny n
    expect(r.breach).toBe(false);
  });

  it("does NOT breach a house-favourable kind", () => {
    const r = evaluateKind({ count: 500, staked: 1000, paid: 880 }, MIN, HALT); // 88%
    expect(r.rtp).toBeCloseTo(0.88, 5);
    expect(r.breach).toBe(false);
  });

  it("is safe on zero stake", () => {
    const r = evaluateKind({ count: 300, staked: 0, paid: 0 }, MIN, HALT);
    expect(r.rtp).toBe(0);
    expect(r.breach).toBe(false);
  });
});
