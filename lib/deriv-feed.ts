/**
 * Shared per-process Deriv tick feed.
 *
 * One persistent WebSocket subscribes to all binary + forex symbols and keeps a
 * ring buffer of recent ticks. Bet/settlement paths try this first so they don't
 * open a fresh WS per request (~300–600ms). Fail closed: if the feed can't serve
 * (cold, stale, gap), callers fall back to one-shot history fetches — never guess.
 *
 * Cluster workers each get their own feed (2 Deriv connections total). Fine.
 */
import type { TickPoint } from "neemiz-binary-engine";

export type FeedTick = TickPoint;

const DERIV_WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public";
const RING_SIZE = 300;
/** Latest-tick freshness bound — reject if older (fail closed). */
export const FEED_FRESHNESS_MS = 5_000;
const HISTORY_WARM_COUNT = 300;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 20_000;

/** Synthetic indices used by binary (must match lib/binary-price.ts). */
export const BINARY_FEED_SYMBOLS = [
  "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
  "R_10", "R_25", "R_50", "R_75", "R_100", "JD10",
] as const;

/** Deriv forex symbols (must match lib/forex-price.ts SYMBOL_MAP values). */
export const FOREX_FEED_SYMBOLS = [
  "frxEURUSD", "frxGBPUSD", "frxUSDJPY", "frxUSDCHF",
  "frxAUDUSD", "frxUSDCAD", "frxNZDUSD", "frxEURGBP",
] as const;

const ALL_SYMBOLS: readonly string[] = [...BINARY_FEED_SYMBOLS, ...FOREX_FEED_SYMBOLS];

type WsCtor = new (url: string) => WebSocket;

type FeedState = {
  buffers: Map<string, FeedTick[]>;
  /** True once we've received a history snapshot (or test seed) for the symbol. */
  warmed: Set<string>;
  /** After reconnect until backfill finishes — refuse to serve. */
  gapSuspect: Set<string>;
  socket: WebSocket | null;
  started: boolean;
  stopping: boolean;
  reconnectAttempt: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  WebSocketClass: WsCtor | null;
  disabled: boolean;
};

function emptyState(): FeedState {
  return {
    buffers: new Map(),
    warmed: new Set(),
    gapSuspect: new Set(),
    socket: null,
    started: false,
    stopping: false,
    reconnectAttempt: 0,
    reconnectTimer: null,
    WebSocketClass: typeof globalThis !== "undefined" && globalThis.WebSocket
      ? (globalThis.WebSocket as unknown as WsCtor)
      : null,
    disabled: process.env.DERIV_FEED === "0",
  };
}

const globalForFeed = globalThis as unknown as { __neemizDerivFeed?: FeedState };
function state(): FeedState {
  if (!globalForFeed.__neemizDerivFeed) globalForFeed.__neemizDerivFeed = emptyState();
  return globalForFeed.__neemizDerivFeed;
}

function pushTick(symbol: string, tick: FeedTick) {
  if (!Number.isFinite(tick.price) || tick.price <= 0 || !Number.isFinite(tick.epoch)) return;
  const s = state();
  let buf = s.buffers.get(symbol);
  if (!buf) {
    buf = [];
    s.buffers.set(symbol, buf);
  }
  const last = buf[buf.length - 1];
  if (last && tick.epoch < last.epoch) return;
  if (last && tick.epoch === last.epoch) {
    last.price = tick.price;
    return;
  }
  buf.push(tick);
  if (buf.length > RING_SIZE) buf.splice(0, buf.length - RING_SIZE);
}

function mergeHistory(symbol: string, ticks: FeedTick[]) {
  const s = state();
  const sorted = [...ticks]
    .filter((t) => Number.isFinite(t.price) && t.price > 0 && Number.isFinite(t.epoch))
    .sort((a, b) => a.epoch - b.epoch);
  if (sorted.length === 0) return;
  const existing = s.buffers.get(symbol) ?? [];
  const byEpoch = new Map<number, FeedTick>();
  for (const t of existing) byEpoch.set(t.epoch, t);
  for (const t of sorted) byEpoch.set(t.epoch, t);
  const merged = [...byEpoch.values()].sort((a, b) => a.epoch - b.epoch);
  s.buffers.set(symbol, merged.slice(-RING_SIZE));
  s.warmed.add(symbol);
  s.gapSuspect.delete(symbol);
}

function parseHistory(msg: {
  echo_req?: { ticks_history?: string };
  history?: { prices?: number[]; times?: number[] };
}): { symbol: string; ticks: FeedTick[] } | null {
  const symbol = msg.echo_req?.ticks_history;
  const prices = msg.history?.prices;
  const times = msg.history?.times;
  if (!symbol || !Array.isArray(prices) || !Array.isArray(times)) return null;
  const ticks: FeedTick[] = [];
  for (let i = 0; i < prices.length; i++) {
    const price = prices[i];
    const epoch = times[i];
    if (typeof price === "number" && typeof epoch === "number") ticks.push({ price, epoch });
  }
  return { symbol, ticks };
}

function handleMessage(raw: string) {
  let msg: {
    error?: { message?: string };
    echo_req?: { ticks_history?: string; ticks?: string };
    history?: { prices?: number[]; times?: number[] };
    tick?: { symbol?: string; quote?: number; epoch?: number };
    msg_type?: string;
  };
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (msg.error) {
    console.warn("[deriv-feed]", msg.error.message ?? "Deriv error");
    return;
  }

  const hist = parseHistory(msg);
  if (hist) {
    mergeHistory(hist.symbol, hist.ticks);
    return;
  }

  const t = msg.tick;
  if (t && typeof t.quote === "number" && typeof t.epoch === "number") {
    const symbol = t.symbol ?? msg.echo_req?.ticks;
    if (typeof symbol === "string") {
      pushTick(symbol, { price: t.quote, epoch: t.epoch });
      // Live ticks alone don't warm a cold symbol — need history first so we
      // don't serve a one-tick buffer as complete post-entry history.
      if (state().warmed.has(symbol)) state().gapSuspect.delete(symbol);
    }
  }
}

function subscribeAll(socket: WebSocket) {
  for (const symbol of ALL_SYMBOLS) {
    // History + subscribe in one request (same pattern as binary-client).
    socket.send(JSON.stringify({
      ticks_history: symbol,
      adjust_start_time: 1,
      count: HISTORY_WARM_COUNT,
      end: "latest",
      style: "ticks",
      subscribe: 1,
    }));
  }
}

function backfillAll(socket: WebSocket) {
  for (const symbol of ALL_SYMBOLS) {
    state().gapSuspect.add(symbol);
    socket.send(JSON.stringify({
      ticks_history: symbol,
      adjust_start_time: 1,
      count: HISTORY_WARM_COUNT,
      end: "latest",
      style: "ticks",
    }));
  }
}

function scheduleReconnect() {
  const s = state();
  if (s.stopping || s.disabled) return;
  if (s.reconnectTimer) return;
  const delay = Math.min(
    RECONNECT_MAX_MS,
    RECONNECT_BASE_MS * Math.pow(2, s.reconnectAttempt),
  );
  s.reconnectAttempt += 1;
  s.reconnectTimer = setTimeout(() => {
    s.reconnectTimer = null;
    connect();
  }, delay);
  // Don't keep the process alive solely for reconnect during idle tests/cron.
  s.reconnectTimer.unref?.();
}

function connect() {
  const s = state();
  if (s.disabled || s.stopping) return;
  if (!s.WebSocketClass) {
    console.warn("[deriv-feed] WebSocket unavailable — feed disabled");
    s.disabled = true;
    return;
  }

  let socket: WebSocket;
  try {
    socket = new s.WebSocketClass(DERIV_WS_URL);
  } catch (err) {
    console.warn("[deriv-feed] connect failed", err);
    scheduleReconnect();
    return;
  }

  s.socket = socket;

  socket.onopen = () => {
    s.reconnectAttempt = 0;
    // Mark all as gap-suspect until history arrives (covers reconnect gaps).
    for (const symbol of ALL_SYMBOLS) s.gapSuspect.add(symbol);
    try {
      subscribeAll(socket);
    } catch (err) {
      console.warn("[deriv-feed] subscribe failed", err);
    }
  };

  socket.onmessage = (event: MessageEvent) => {
    handleMessage(String(event.data));
  };

  socket.onerror = () => {
    // onclose will reconnect
  };

  socket.onclose = () => {
    s.socket = null;
    for (const symbol of ALL_SYMBOLS) s.gapSuspect.add(symbol);
    scheduleReconnect();
  };
}

/** Start the shared feed (idempotent). Call from instrumentation on nodejs runtime. */
export function startDerivFeed(): void {
  const s = state();
  if (s.disabled || s.started) return;
  s.started = true;
  s.stopping = false;
  connect();
}

export function isDerivFeedStarted(): boolean {
  return state().started && !state().disabled;
}

export function isDerivFeedServing(symbol: string): boolean {
  const s = state();
  return s.started && !s.disabled && s.warmed.has(symbol) && !s.gapSuspect.has(symbol);
}

/**
 * Latest tick if the feed is serving this symbol and the tick is fresh.
 * Returns null → caller must fall back or fail closed.
 */
export function getLatestTick(symbol: string): FeedTick | null {
  if (!isDerivFeedServing(symbol)) return null;
  const buf = state().buffers.get(symbol);
  const last = buf?.[buf.length - 1];
  if (!last) return null;
  const ageMs = Date.now() - last.epoch * 1000;
  if (ageMs > FEED_FRESHNESS_MS) return null;
  return last;
}

/**
 * Ticks strictly after `startEpoch` from the ring buffer.
 * Returns null if the feed can't prove continuity from startEpoch (gap / cold).
 */
export function getTicksSince(symbol: string, startEpoch: number): FeedTick[] | null {
  if (!isDerivFeedServing(symbol)) return null;
  const buf = state().buffers.get(symbol);
  if (!buf || buf.length === 0) return null;
  const oldest = buf[0].epoch;
  // Buffer doesn't reach back to startEpoch — missing early ticks would corrupt
  // duration-based settlement. Force one-shot history fallback.
  if (oldest > startEpoch + 1) return null;
  return buf.filter((t) => t.epoch > startEpoch);
}

/** Test helpers — not for production paths. */
export function __resetDerivFeedForTests(): void {
  const s = state();
  s.stopping = true;
  if (s.reconnectTimer) clearTimeout(s.reconnectTimer);
  try { s.socket?.close(); } catch { /* noop */ }
  globalForFeed.__neemizDerivFeed = emptyState();
}

export function __seedDerivFeedForTests(
  symbol: string,
  ticks: FeedTick[],
  opts?: { gapSuspect?: boolean },
): void {
  const s = state();
  s.started = true;
  s.disabled = false;
  mergeHistory(symbol, ticks);
  if (opts?.gapSuspect) s.gapSuspect.add(symbol);
  else s.gapSuspect.delete(symbol);
}

/** Request a one-shot history backfill on the live socket (used after gaps). */
export function requestFeedBackfill(): void {
  const s = state();
  if (!s.socket || s.socket.readyState !== 1) return;
  backfillAll(s.socket);
}
