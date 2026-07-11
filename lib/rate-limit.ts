/**
 * Rate limiter — in-process fixed window by default; optional Redis backend
 * when `REDIS_URL` is set so limits are global across cluster workers.
 *
 * Fail-open to memory if Redis is unreachable (still throttles per worker).
 */
import { createClient, type RedisClientType } from "redis";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
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

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
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

// ─── Optional Redis (cluster-wide) ───────────────────────────────────────────

const REDIS_KEY_PREFIX = "rl:";
let redisClient: RedisClientType | null = null;
let redisInit: Promise<RedisClientType | null> | null = null;
let redisDisabled = false;

function redisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim();
  return url || null;
}

async function getRedis(): Promise<RedisClientType | null> {
  if (redisDisabled) return null;
  const url = redisUrl();
  if (!url) return null;
  if (redisClient?.isOpen) return redisClient;
  if (redisInit) return redisInit;

  redisInit = (async () => {
    try {
      const client = createClient({
        url,
        socket: {
          connectTimeout: 1_500,
          reconnectStrategy: (retries) => (retries > 3 ? false : Math.min(retries * 200, 1_000)),
        },
      });
      client.on("error", () => {
        /* logged once below on connect failure; avoid spam */
      });
      await client.connect();
      redisClient = client as RedisClientType;
      return redisClient;
    } catch (err) {
      console.warn("[rate-limit] Redis unavailable — using in-memory limiter", err instanceof Error ? err.message : err);
      redisDisabled = true;
      redisClient = null;
      return null;
    } finally {
      redisInit = null;
    }
  })();

  return redisInit;
}

async function redisRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult | null> {
  const client = await getRedis();
  if (!client) return null;

  const rkey = `${REDIS_KEY_PREFIX}${key}`;
  try {
    const count = await client.incr(rkey);
    if (count === 1) {
      await client.pExpire(rkey, windowMs);
    }
    const ttlMs = await client.pTTL(rkey);
    const retryAfterSec = ttlMs > 0 ? Math.ceil(ttlMs / 1000) : Math.ceil(windowMs / 1000);

    if (count > limit) {
      return { ok: false, remaining: 0, retryAfterSec };
    }
    return { ok: true, remaining: Math.max(0, limit - count), retryAfterSec: 0 };
  } catch (err) {
    console.warn("[rate-limit] Redis command failed — falling back to memory", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Record a hit against `key` and report whether it is within `limit` per
 * `windowMs`. Prefer Redis when `REDIS_URL` is set; otherwise in-memory.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const fromRedis = await redisRateLimit(key, limit, windowMs);
  if (fromRedis) return fromRedis;
  return memoryRateLimit(key, limit, windowMs);
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

/** Test helper: clear in-memory buckets (does not flush Redis). */
export function __resetMemoryRateLimitForTests(): void {
  buckets.clear();
  lastSweep = 0;
}
