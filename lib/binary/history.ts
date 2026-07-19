export type ClosedPositionStatus = "won" | "lost" | "partial";

export type ClosedPosition = {
  id: string;
  title: string;
  subtitle: string;
  stake: number;
  payout: number;
  status: ClosedPositionStatus;
  closedAt: number;
  isReal?: boolean;
};

type ApiStatus = string | null | undefined;

function dateMs(value: string | Date | null | undefined): number {
  if (!value) return 0;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function closedAt(input: { settledAt?: string | Date | null; createdAt?: string | Date | null; openedAt?: number }): number {
  return dateMs(input.settledAt) || dateMs(input.createdAt) || input.openedAt || Date.now();
}

/**
 * UI label from credited amount vs stake. Server `won` (credit >= stake) stays
 * unchanged for settle; Vanilla ITM partial credits are LOST in DB but must not
 * render as a full-stake loss when money was returned.
 */
export function closedDisplayStatus(stake: number, credit: number): ClosedPositionStatus {
  const s = Number(stake) || 0;
  const c = Number(credit) || 0;
  if (c > 0 && c < s) return "partial";
  if (c >= s && c > 0) return "won";
  return "lost";
}

/** Prefer server-authoritative digits over optimistic client feed digits. */
export function applyServerBinaryDigits<T extends { entryDigit: number; exitDigit?: number }>(
  trade: T,
  server: { entryDigit?: number | null; exitDigit?: number | null },
): T {
  const next = { ...trade };
  if (Number.isInteger(server.entryDigit) && server.entryDigit! >= 0 && server.entryDigit! <= 9) {
    next.entryDigit = server.entryDigit!;
  }
  if (Number.isInteger(server.exitDigit) && server.exitDigit! >= 0 && server.exitDigit! <= 9) {
    next.exitDigit = server.exitDigit!;
  }
  return next;
}

export function toBinaryClosedPosition(input: {
  id: string;
  market: string;
  side: string;
  stake: number;
  payout: number;
  entryDigit: number;
  exitDigit?: number | null;
  status: ApiStatus;
  settledAt?: string | Date | null;
  createdAt?: string | Date | null;
  openedAt?: number;
  isReal?: boolean;
}): ClosedPosition {
  const stake = Number(input.stake) || 0;
  const payout = Number(input.payout) || 0;
  // Digit rows store place-time potential payout even on LOST — never infer from payout.
  const apiWon = String(input.status).toUpperCase() === "WON" || String(input.status).toLowerCase() === "won";
  return {
    id: input.id,
    title: input.side,
    subtitle: `${input.market} · digit ${input.entryDigit}${input.exitDigit == null ? "" : ` → ${input.exitDigit}`}`,
    stake,
    payout,
    status: apiWon ? "won" : "lost",
    closedAt: closedAt(input),
    isReal: input.isReal,
  };
}

export function toDirectionalClosedPosition(input: {
  id: string;
  market: string;
  kind: string;
  side: string;
  stake: number;
  payout?: number | null;
  status: ApiStatus;
  durationTicks?: number | null;
  settledAt?: string | Date | null;
  createdAt?: string | Date | null;
  isReal?: boolean;
}): ClosedPosition {
  const stake = Number(input.stake) || 0;
  const payout = Number(input.payout ?? 0) || 0;
  const side = input.side === "NO_TOUCH" ? "NO TOUCH" : input.side;
  return {
    id: input.id,
    title: side,
    subtitle: `${input.market} · ${input.kind.replaceAll("_", " ")}${input.durationTicks ? ` · ${input.durationTicks} ticks` : ""}`,
    stake,
    payout,
    status: closedDisplayStatus(stake, payout),
    closedAt: closedAt(input),
    isReal: input.isReal,
  };
}

export function toAccumulatorClosedPosition(input: {
  id: string;
  market: string;
  growthRate: number;
  stake: number;
  payout?: number | null;
  status: ApiStatus;
  ticksSurvived?: number | null;
  settledAt?: string | Date | null;
  createdAt?: string | Date | null;
  isReal?: boolean;
}): ClosedPosition {
  const stake = Number(input.stake) || 0;
  const payout = Number(input.payout ?? 0) || 0;
  return {
    id: input.id,
    title: `Accumulator ${input.growthRate}%`,
    subtitle: `${input.market}${input.ticksSurvived == null ? "" : ` · ${input.ticksSurvived} ticks`}`,
    stake,
    payout,
    status: closedDisplayStatus(stake, payout),
    closedAt: closedAt(input),
    isReal: input.isReal,
  };
}

export function toLeveragedClosedPosition(input: {
  id: string;
  market: string;
  kind: string;
  direction: string;
  stake: number;
  payout?: number | null;
  status: ApiStatus;
  settledAt?: string | Date | null;
  createdAt?: string | Date | null;
  isReal?: boolean;
}): ClosedPosition {
  const stake = Number(input.stake) || 0;
  const payout = Number(input.payout ?? 0) || 0;
  return {
    id: input.id,
    title: `${input.kind === "TURBO" ? "Turbo" : "Multiplier"} ${input.direction}`,
    subtitle: input.market,
    stake,
    payout,
    status: closedDisplayStatus(stake, payout),
    closedAt: closedAt(input),
    isReal: input.isReal,
  };
}

export function mergeClosedPositions(...groups: ClosedPosition[][]): ClosedPosition[] {
  const byId = new Map<string, ClosedPosition>();
  for (const group of groups) {
    for (const position of group) {
      if (!byId.has(position.id)) byId.set(position.id, position);
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.closedAt - a.closedAt);
}
