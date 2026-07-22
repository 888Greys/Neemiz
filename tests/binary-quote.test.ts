import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/binary/quote/route";
import { priceDigitServer, resolveDigitEdgeFloor, previewDigitPayout } from "@/lib/binary/server-price";
import { getCalibrationTicks } from "@/lib/binary/calibration";
import { getLiveEntrySpot } from "@/lib/binary-price";
import { exitDigitFromQuote } from "@/lib/binary/kernel";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 59, retryAfterSec: 0 }),
  tooManyRequests: vi.fn(),
}));

vi.mock("@/lib/binary/calibration", () => ({
  getCalibrationTicks: vi.fn(),
}));

vi.mock("@/lib/binary-price", () => ({
  getLiveEntrySpot: vi.fn(),
}));

/** Near-uniform last-digit walk so Even/Odd price stably. */
function makeTicks(n = 800): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const d = i % 10;
    out.push(Number((1000 + d / 100).toFixed(2)));
  }
  return out;
}

describe("POST /api/binary/quote", () => {
  const ticks = makeTicks();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCalibrationTicks).mockResolvedValue({
      prices: ticks,
      entrySpot: ticks[ticks.length - 1],
      entryEpoch: 1_700_000_000,
      edge: 0.09,
    });
    vi.mocked(getLiveEntrySpot).mockResolvedValue({
      spot: ticks[ticks.length - 1],
      epoch: 1_700_000_000,
    });
  });

  function makeRequest(body: Record<string, unknown>) {
    return new Request("http://localhost/api/binary/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns priceDigitServer payouts, not static previewDigitPayout", async () => {
    const stake = 1000;
    const side = "Even" as const;
    const targetDigit = 0;
    const durationTicks = 5;

    const res = await POST(makeRequest({
      market: "R_50",
      side,
      stake,
      targetDigit,
      durationTicks,
    }));
    expect(res.status).toBe(200);
    const data = await res.json() as { accepted: boolean; payout: number; multiplier: number };

    const entryDigit = exitDigitFromQuote(ticks[ticks.length - 1]);
    const edge = resolveDigitEdgeFloor(side, targetDigit, 0.09);
    const expected = priceDigitServer({
      side,
      targetDigit,
      durationTicks,
      stake,
      ticks,
      edgeFloor: edge,
      market: "R_50",
      entryDigit,
    });
    expect(expected.accepted).toBe(true);
    if (!expected.accepted) return;

    expect(data.accepted).toBe(true);
    expect(data.payout).toBe(expected.payout);
    expect(data.multiplier).toBe(expected.multiplier);

    // Static preview is the old Buy-button path (~1.80×). Live quote must be
    // allowed to diverge — that's the bug this route exists to fix.
    const preview = previewDigitPayout(stake, side, targetDigit);
    expect(preview).toBe(1800);
    // When Wilson pricing differs from the 50/50 preview, the quote must follow
    // the server (not the preview). If they happen to match on this fixture,
    // at least assert the quote equals priceDigitServer (already done above).
    if (expected.payout !== preview) {
      expect(data.payout).not.toBe(preview);
    }
  });

  it("quotes both family sides in one request via priceDigitServer", async () => {
    const stake = 100;
    const res = await POST(makeRequest({
      market: "1HZ10V",
      sides: ["Even", "Odd"],
      stake,
      targetDigit: 5,
      durationTicks: 5,
    }));
    expect(res.status).toBe(200);
    const data = await res.json() as {
      quotes: Record<string, { accepted: boolean; payout?: number; multiplier?: number }>;
    };

    const entryDigit = exitDigitFromQuote(ticks[ticks.length - 1]);
    for (const side of ["Even", "Odd"] as const) {
      const edge = resolveDigitEdgeFloor(side, 5, 0.09);
      const expected = priceDigitServer({
        side, targetDigit: 5, durationTicks: 5, stake, ticks, edgeFloor: edge,
        market: "1HZ10V", entryDigit,
      });
      expect(expected.accepted).toBe(true);
      if (!expected.accepted) continue;
      expect(data.quotes[side]).toMatchObject({
        accepted: true,
        payout: expected.payout,
        multiplier: expected.multiplier,
      });
    }
  });

  it("rejects invalid market without calling the pricer feed", async () => {
    const res = await POST(makeRequest({
      market: "NOPE",
      side: "Even",
      stake: 100,
      targetDigit: 0,
      durationTicks: 5,
    }));
    expect(res.status).toBe(400);
    expect(getCalibrationTicks).not.toHaveBeenCalled();
  });

  it("returns accepted:false for Matches when the stability gate trips (no fake payout)", async () => {
    // ~17.5% target digit — outside [8%, 12%], same shape as Vol-10 digit-6 reports.
    // Seeded + NON-autocorrelated (digit 6 over-represented, rest uniform): this
    // trips the Matches stability gate while leaving Differs a genuine ~82% bet.
    // Differs is now priced CONDITIONALLY on the entry digit (see server-price),
    // so the series must be long enough for ≥100 conditional windows per entry
    // digit — a periodic/degenerate series would make conditional Differs
    // near-certain and correctly reject. 2000 ticks gives ample conditional depth.
    let seed = 0x9e3779b9;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const otherDigits = [0, 1, 2, 3, 4, 5, 7, 8, 9];
    const skewed = Array.from({ length: 2000 }, () => {
      const d = rand() < 0.175 ? 6 : otherDigits[Math.floor(rand() * 9)];
      return Number((1000 + d / 100).toFixed(2));
    });
    vi.mocked(getCalibrationTicks).mockResolvedValue({
      prices: skewed,
      entrySpot: skewed[skewed.length - 1],
      entryEpoch: 1_700_000_000,
      edge: 0.09,
    });
    vi.mocked(getLiveEntrySpot).mockResolvedValue({
      spot: skewed[skewed.length - 1],
      epoch: 1_700_000_000,
    });

    const res = await POST(makeRequest({
      market: "1HZ10V",
      sides: ["Matches", "Differs"],
      stake: 50,
      targetDigit: 6,
      durationTicks: 5,
    }));
    expect(res.status).toBe(200);
    const data = await res.json() as {
      quotes: Record<string, { accepted: boolean; payout?: number; reason?: string }>;
    };
    expect(data.quotes.Matches).toMatchObject({ accepted: false });
    expect(data.quotes.Matches.reason).toMatch(/digit distribution unstable/i);
    expect(data.quotes.Matches.payout).toBeUndefined();
    // Differs stays offerable on the same market/target.
    expect(data.quotes.Differs.accepted).toBe(true);
    expect(data.quotes.Differs.payout).toBeGreaterThan(0);
  });
});
