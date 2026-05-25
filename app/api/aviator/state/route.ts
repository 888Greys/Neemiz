import {
  callAviatorService,
  mapGoStatus,
  roundNumberFromState,
  type GoAviatorState,
} from "@/lib/aviator/service";

export const dynamic = "force-dynamic";

const BETTING_MS = 5_000;

export async function GET() {
  const state = await callAviatorService<GoAviatorState>("/api/v1/game/state");
  const mappedState = mapGoStatus(state.status);
  const start = new Date(state.start_time);

  return Response.json({
    round: {
      id: state.round_id,
      roundNumber: roundNumberFromState(state),
      serverSeedHash: state.hash_commitment,
      serverSeed: undefined,
      crashPoint: mappedState === "CRASHED" ? state.current_multiplier : undefined,
      state: mappedState,
      bettingEndsAt:
        mappedState === "BETTING" && !Number.isNaN(start.getTime())
          ? new Date(start.getTime() + BETTING_MS).toISOString()
          : null,
      flyingStartedAt:
        mappedState === "FLYING" && !Number.isNaN(start.getTime())
          ? new Date(start.getTime() + BETTING_MS).toISOString()
          : null,
      crashedAt:
        mappedState === "CRASHED" && state.crash_time && !state.crash_time.startsWith("0001-")
          ? state.crash_time
          : null,
      createdAt: state.start_time,
    },
    bets: [],
  });
}
