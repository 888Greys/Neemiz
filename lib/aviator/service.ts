const DEFAULT_AVIATOR_SERVICE_URL = "https://aviator.nezeem.com";

export type GoAviatorState = {
  round_id: string;
  hash_commitment: string;
  client_seed: string;
  current_multiplier: number;
  status: "BETTING" | "RUNNING" | "CRASHED" | string;
  start_time: string;
  crash_time?: string;
  nonce: number;
};

export type GoBetResponse = {
  success: boolean;
  message: string;
  bet_id?: string;
  balance?: number;
};

export type GoCashoutResponse = {
  success: boolean;
  message: string;
  multiplier?: number;
  payout?: number;
  balance?: number;
};

export function aviatorServiceUrl() {
  return (process.env.AVIATOR_SERVICE_URL ?? DEFAULT_AVIATOR_SERVICE_URL).replace(/\/+$/, "");
}

export async function callAviatorService<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${aviatorServiceUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : typeof payload === "object" && payload && "message" in payload
          ? String((payload as { message: unknown }).message)
          : "Aviator service request failed";
    throw new Error(message);
  }

  return payload as T;
}

export function mapGoStatus(status: GoAviatorState["status"]) {
  if (status === "RUNNING") return "FLYING";
  if (status === "CRASHED") return "CRASHED";
  return "BETTING";
}

export function roundNumberFromState(state: GoAviatorState) {
  if (Number.isFinite(state.nonce)) return state.nonce;
  const suffix = state.round_id.split("-").at(-1);
  const parsed = Number(suffix);
  return Number.isFinite(parsed) ? parsed : 0;
}

