/**
 * Independent spend controls enforced ON THE SIGNER, so they hold even if the
 * web app (nez) is fully compromised. Fail-closed: anything unparseable or over
 * a limit is rejected, not signed.
 *
 *   • per-tx cap        — max amount in a single withdrawal
 *   • rolling 24h cap   — max total per crypto per UTC day (file-persisted)
 *   • approval gate     — optional: above this, refuse with APPROVAL_REQUIRED
 *   • idempotency       — same key never broadcasts twice (returns prior hash)
 *
 * State is tiny JSON in SIGNER_STATE_DIR so caps + idempotency survive restarts.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const STATE_DIR = process.env.SIGNER_STATE_DIR ?? "/data";
const DAILY_FILE = join(STATE_DIR, "daily.json");
const IDEMPOTENCY_FILE = join(STATE_DIR, "idempotency.json");

function ensureDir() {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
}

function parseCapMap(envVar: string, fallback: Record<string, number>): Record<string, number> {
  const raw = process.env[envVar];
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    return { ...fallback, ...parsed };
  } catch {
    console.error(`[policy] ${envVar} is not valid JSON — using defaults`);
    return fallback;
  }
}

// Conservative defaults for a small (<$5k) hot float. Override via env.
const PER_TX_CAP = parseCapMap("SIGNER_PER_TX_CAP", { DEFAULT: 1000, USDT: 1000, USDC: 1000 });
const DAILY_CAP  = parseCapMap("SIGNER_DAILY_CAP",  { DEFAULT: 2000, USDT: 2000, USDC: 2000 });
// Unset by default (disabled). Set e.g. {"USDT":500} to force manual approval above 500.
const APPROVAL_THRESHOLD = parseCapMap("SIGNER_APPROVAL_THRESHOLD", {});

function capFor(map: Record<string, number>, crypto: string): number | undefined {
  return map[crypto] ?? map.DEFAULT;
}

// ── idempotency ──

function loadIdempotency(): Record<string, string> {
  try { return JSON.parse(readFileSync(IDEMPOTENCY_FILE, "utf8")); } catch { return {}; }
}
function saveIdempotency(map: Record<string, string>) {
  ensureDir();
  writeFileSync(IDEMPOTENCY_FILE, JSON.stringify(map), "utf8");
}
export function priorTxHash(key: string): string | undefined {
  return loadIdempotency()[key];
}
export function recordTxHash(key: string, txHash: string) {
  const map = loadIdempotency();
  map[key] = txHash;
  saveIdempotency(map);
}

// ── daily totals ──

function today(): string { return new Date().toISOString().slice(0, 10); }

function loadDaily(): { date: string; totals: Record<string, number> } {
  try {
    const d = JSON.parse(readFileSync(DAILY_FILE, "utf8"));
    if (d.date === today()) return d;
  } catch { /* fall through */ }
  return { date: today(), totals: {} };
}
function saveDaily(d: { date: string; totals: Record<string, number> }) {
  ensureDir();
  writeFileSync(DAILY_FILE, JSON.stringify(d), "utf8");
}

export class PolicyError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

/**
 * Throws PolicyError if the request must not be signed. Call BEFORE broadcasting.
 * Does not mutate totals — call recordSpend() only after a confirmed broadcast.
 */
export function assertWithinPolicy(crypto: string, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PolicyError("INVALID_AMOUNT", "Invalid amount");
  }

  const perTx = capFor(PER_TX_CAP, crypto);
  if (perTx != null && amount > perTx) {
    throw new PolicyError("CAP_EXCEEDED", `Amount ${amount} ${crypto} exceeds per-tx cap ${perTx}`);
  }

  const approval = capFor(APPROVAL_THRESHOLD, crypto);
  if (approval != null && amount > approval) {
    throw new PolicyError("APPROVAL_REQUIRED", `Amount ${amount} ${crypto} needs manual approval (> ${approval})`);
  }

  const dailyCap = capFor(DAILY_CAP, crypto);
  if (dailyCap != null) {
    const d = loadDaily();
    const used = d.totals[crypto] ?? 0;
    if (used + amount > dailyCap) {
      throw new PolicyError("DAILY_CAP_EXCEEDED", `Would exceed 24h cap for ${crypto}: ${used}+${amount} > ${dailyCap}`);
    }
  }
}

/** Add a confirmed broadcast to today's running total. */
export function recordSpend(crypto: string, amount: number): void {
  const d = loadDaily();
  d.totals[crypto] = (d.totals[crypto] ?? 0) + amount;
  saveDaily(d);
}
