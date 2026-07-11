import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetMemoryRateLimitForTests,
  rateLimit,
} from "@/lib/rate-limit";

describe("rateLimit (memory)", () => {
  afterEach(() => {
    __resetMemoryRateLimitForTests();
    delete process.env.REDIS_URL;
    vi.unstubAllGlobals();
  });

  it("allows up to the limit then rejects", async () => {
    const key = `test-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      const r = await rateLimit(key, 3, 60_000);
      expect(r.ok).toBe(true);
    }
    const blocked = await rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("isolates keys", async () => {
    const a = await rateLimit("a", 1, 60_000);
    const b = await rateLimit("b", 1, 60_000);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect((await rateLimit("a", 1, 60_000)).ok).toBe(false);
    expect((await rateLimit("b", 1, 60_000)).ok).toBe(false);
  });
});
