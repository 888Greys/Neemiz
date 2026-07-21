import { describe, it, expect, afterEach, vi } from "vitest";
import { isValidPaymentRef, normalizePaymentRef, paymentRefError } from "@/lib/p2p/payment-ref";
import {
  detectP2PRingSignals,
  p2pRingFlags,
  releaseReviewReason,
  releaseReviewThresholdKes,
} from "@/lib/p2p/ring-detection";

// ─────────────────────────────────────────────────────────────────────────────
// P2P HARDENING SUITE (2026-07-20 incident)
//
// A 3-account ring marked P2P orders "paid" with an EMPTY payment reference
// (no M-Pesa sent), then self-released escrow from a linked merchant account.
// These tests pin the four countermeasures:
//   1. mandatory, format-validated payment_ref at mark-paid
//   2. admin review for releases above a KES threshold
//   3. buyer↔seller ring detection (shared device / transfer history)
//   4. (cron auto-cancel of unverified PAID orders is route-level; not unit-tested here)
// ─────────────────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isValidPaymentRef", () => {
  it("rejects empty / missing references (the incident vector)", () => {
    expect(isValidPaymentRef(null, "MPESA")).toBe(false);
    expect(isValidPaymentRef(undefined, "MPESA")).toBe(false);
    expect(isValidPaymentRef("", "MPESA")).toBe(false);
    expect(isValidPaymentRef("   ", "MPESA")).toBe(false);
  });

  it("accepts real M-Pesa codes and normalizes case/whitespace", () => {
    expect(isValidPaymentRef("SDA4K2X9PT", "MPESA")).toBe(true);
    expect(isValidPaymentRef("  sda4k2x9pt ", "MPESA")).toBe(true);
    expect(isValidPaymentRef("QHJ2K3L9MZ", "m-pesa")).toBe(true);
  });

  it("rejects malformed M-Pesa codes", () => {
    expect(isValidPaymentRef("SDA4K2X9P", "MPESA")).toBe(false);   // 9 chars
    expect(isValidPaymentRef("SDA4K2X9PT1", "MPESA")).toBe(false); // 11 chars
    expect(isValidPaymentRef("1DA4K2X9PT", "MPESA")).toBe(false);  // starts with digit
    expect(isValidPaymentRef("SDA4K2X9P!", "MPESA")).toBe(false);  // punctuation
  });

  it("uses the generic rule for bank/CHAT rails", () => {
    expect(isValidPaymentRef("TRX-2026-07-20-8841", "BANK")).toBe(true);
    expect(isValidPaymentRef("8841XX", "CHAT")).toBe(true);
    expect(isValidPaymentRef("abc", "BANK")).toBe(false);
    expect(isValidPaymentRef(null, "BANK")).toBe(false);
  });

  it("normalizePaymentRef trims and uppercases", () => {
    expect(normalizePaymentRef("  sda4k2x9pt ")).toBe("SDA4K2X9PT");
    expect(normalizePaymentRef(null)).toBe("");
  });

  it("paymentRefError explains the required format", () => {
    expect(paymentRefError("MPESA")).toContain("10-character M-Pesa");
    expect(paymentRefError("BANK")).toContain("payment reference");
  });
});

describe("release review gate", () => {
  it("routes releases above the default 10,000 KES threshold to review", () => {
    expect(releaseReviewReason(10_000, [])).toContain("threshold");
    expect(releaseReviewReason(50_000, [])).toContain("threshold");
    expect(releaseReviewReason(9_999, [])).toBeNull();
    expect(releaseReviewReason(0, [])).toBeNull();
  });

  it("honors the P2P_RELEASE_REVIEW_THRESHOLD_KES env override", () => {
    vi.stubEnv("P2P_RELEASE_REVIEW_THRESHOLD_KES", "5000");
    expect(releaseReviewThresholdKes()).toBe(5000);
    expect(releaseReviewReason(6_000, [])).toContain("threshold");
    expect(releaseReviewReason(4_000, [])).toBeNull();
  });

  it("threshold 0 disables size-based review (ring flags still apply)", () => {
    vi.stubEnv("P2P_RELEASE_REVIEW_THRESHOLD_KES", "0");
    expect(releaseReviewReason(999_999, [])).toBeNull();
    expect(releaseReviewReason(999_999, ["shared_device"])).toContain("shared_device");
  });

  it("any ring flag forces review regardless of size", () => {
    expect(releaseReviewReason(100, ["transfer_history"])).toContain("transfer_history");
    expect(releaseReviewReason(100, ["buyer_is_seller"])).toContain("buyer_is_seller");
    expect(releaseReviewReason(100, [])).toBeNull();
  });
});

describe("p2pRingFlags", () => {
  it("parses stored JSON safely", () => {
    expect(p2pRingFlags(["shared_device", "transfer_history"])).toEqual(["shared_device", "transfer_history"]);
    expect(p2pRingFlags([])).toEqual([]);
    expect(p2pRingFlags(null)).toEqual([]);
    expect(p2pRingFlags(undefined)).toEqual([]);
    expect(p2pRingFlags("shared_device")).toEqual([]);
    expect(p2pRingFlags(["shared_device", 42, null])).toEqual(["shared_device"]);
  });
});

describe("detectP2PRingSignals", () => {
  function fakeTx(opts: { sellerSharesDevice?: boolean; transfers?: number }) {
    return {
      loginDevice: {
        findMany: async () => [{ deviceHash: "fp-buyer-1" }, { deviceHash: "fp-buyer-2" }],
        count: async () => (opts.sellerSharesDevice ? 1 : 0),
      },
      transaction: {
        count: async () => opts.transfers ?? 0,
      },
    };
  }

  it("flags buyer_is_seller immediately", async () => {
    const signals = await detectP2PRingSignals(fakeTx({}), "u1", "u1");
    expect(signals).toEqual(["buyer_is_seller"]);
  });

  it("flags a shared device fingerprint", async () => {
    const signals = await detectP2PRingSignals(fakeTx({ sellerSharesDevice: true }), "u1", "u2");
    expect(signals).toContain("shared_device");
    expect(signals).not.toContain("transfer_history");
  });

  it("flags prior wallet transfers between the pair", async () => {
    const signals = await detectP2PRingSignals(fakeTx({ transfers: 7 }), "u1", "u2");
    expect(signals).toEqual(["transfer_history"]);
  });

  it("returns clean when there are no signals", async () => {
    const signals = await detectP2PRingSignals(fakeTx({}), "u1", "u2");
    expect(signals).toEqual([]);
  });

  it("handles missing ids defensively", async () => {
    expect(await detectP2PRingSignals(fakeTx({}), "", "u2")).toEqual([]);
    expect(await detectP2PRingSignals(fakeTx({}), "u1", "")).toEqual([]);
  });
});
