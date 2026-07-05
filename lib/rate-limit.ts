// ─── In-process rate limiter ─────────────────────────────────────────────────
// A small dependency-free fixed-window limiter. Keyed by an arbitrary string
// (e.g. `ip:route` or `user:route`). Intended as defense-in-depth against
// brute force (admin TOTP), credential stuffing, and payout spam.
//
// NOTE: state is per-process. With clustering (WEB_CONCURRENCY) the window is
// enforced independently per worker, so the effective limit is N×limit across
// the cluster — still a large reduction from "unbounded". For a hard global
// limit, back this with Redis (already running on the box). For brute-force
// mitigation the in-process bucket is sufficient and adds zero latency/deps.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  // Opportunistic GC so the map can't grow unbounded under key churn.
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Record a hit against `key` and report whether it is within `limit` per
 * `windowMs`. Call once per request you want to throttle.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - existing.count, retryAfterSec: 0 };
}

/** Best-effort client IP from common proxy headers (nginx/Cloudflare). */
export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Standard 429 response with a Retry-After header. */
export function tooManyRequests(retryAfterSec: number): Response {
  return Response.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfterSec)) } },
  );
}
