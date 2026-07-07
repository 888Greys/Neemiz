export type ClosedPositionStatus = "won" | "lost";

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

function wonFromStatus(status: ApiStatus, payout: number | null | undefined): ClosedPositionStatus {
  const s = String(status ?? "").toUpperCase();
  if (s === "WON" || s === "CLOSED") return payout && payout > 0 ? "won" : s === "WON" ? "won" : "lost";
  return "lost";
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
  return {
    id: input.id,
    title: input.side,
    subtitle: `${input.market} · digit ${input.entryDigit}${input.exitDigit == null ? "" : ` → ${input.exitDigit}`}`,
    stake,
    payout,
    status: String(input.status).toUpperCase() === "WON" || String(input.status).toLowerCase() === "won" ? "won" : "lost",
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
    status: wonFromStatus(input.status, payout),
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
    status: wonFromStatus(input.status, payout),
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
    status: wonFromStatus(input.status, payout),
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
