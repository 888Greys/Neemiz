/**
 * Server-side push to a per-user Supabase Realtime broadcast channel.
 * Failures are swallowed — poll + cron remain the backstops.
 */
import { createAdminClient } from "@/lib/supabase/admin";

export const BINARY_USER_CHANNEL_PREFIX = "binary:";

export function binaryUserChannel(userId: string): string {
  return `${BINARY_USER_CHANNEL_PREFIX}${userId}`;
}

export type TradeSettledPayload = {
  kind: "binary" | "directional";
  tradeId: string;
  outcome: "won" | "lost" | "already";
  winAmount?: number;
  exitDigit?: number;
  exitSpot?: number;
  status: "WON" | "LOST" | "ALREADY";
};

export async function broadcastToUser(
  userId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const channel = supabase.channel(binaryUserChannel(userId));
    await channel.subscribe();
    await channel.send({ type: "broadcast", event, payload });
    await supabase.removeChannel(channel);
  } catch (err) {
    console.warn("[realtime-user] broadcast failed", err instanceof Error ? err.message : err);
  }
}

export async function broadcastTradeSettled(
  userId: string,
  payload: TradeSettledPayload,
): Promise<void> {
  await broadcastToUser(userId, "trade:settled", payload);
}
