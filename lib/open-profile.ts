/** Profile modal sub-views (keep in sync with ProfileModal). */
export type OpenProfileView =
  | "main"
  | "settings"
  | "bets"
  | "transactions"
  | "withdraw"
  | "promotion-codes"
  | "notifications"
  | "security"
  | "language"
  | "currency"
  | "support";

export const OPEN_PROFILE_EVENT = "nezeem:open-profile";

/** Open the app-wide Profile modal from any client component. */
export function openAppProfile(view?: OpenProfileView) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(OPEN_PROFILE_EVENT, { detail: { view: view ?? "main" } }),
  );
}
