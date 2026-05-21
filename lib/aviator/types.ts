/**
 * Shared TypeScript types for the Aviator crash game.
 * Used by both API routes and client components.
 */

export type AviatorRoundState = "WAITING" | "BETTING" | "FLYING" | "CRASHED";
export type AviatorBetStatus  = "ACTIVE" | "CASHEDOUT" | "LOST";

export interface AviatorRound {
  id:              string;
  roundNumber:     number;
  serverSeedHash:  string;
  serverSeed?:     string;   // only revealed after CRASHED
  crashPoint?:     number;   // only exposed after CRASHED
  state:           AviatorRoundState;
  bettingEndsAt:   string | null;   // ISO string
  flyingStartedAt: string | null;   // ISO string
  crashedAt:       string | null;   // ISO string
  createdAt:       string;
}

export interface AviatorBetPublic {
  id:          string;
  roundId:     string;
  userId:      string;
  username:    string | null;
  panelIndex:  number;
  betAmount:   number;
  autoCashout: number | null;
  cashoutAt:   number | null;
  winAmount:   number | null;
  status:      AviatorBetStatus;
  placedAt:    string;
}

/** Full game state returned by GET /api/aviator/state */
export interface AviatorGameState {
  round: AviatorRound;
  bets:  AviatorBetPublic[];
}

/** My bets keyed by panelIndex (0 or 1) */
export type MyBets = Partial<Record<0 | 1, AviatorBetPublic>>;
