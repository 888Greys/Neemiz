// ─── Master withdrawal kill switch ───────────────────────────────────────────
// One lever to block EVERY money-out path (fiat + crypto withdrawals and wallet
// transfers) platform-wide, for incident response. Fail-safe and reversible:
//
//   • Set WITHDRAWALS_DISABLED=true  → all vectors return 503 immediately.
//   • Unset it (or set to anything else) → normal operation resumes.
//
// process.env is read per-request, so flipping the env var + restarting the
// app process is enough — no code deploy needed to toggle it.
//
// Added 2026-06-25 after the owner reported accounts withdrawing balances they
// did not hold (suspected double-spend race in the withdraw balance check).

export function withdrawalsDisabled(): boolean {
  return process.env.WITHDRAWALS_DISABLED === "true";
}

/** Returns a 503 Response when withdrawals are globally disabled, else null. */
export function withdrawalsDisabledResponse(): Response | null {
  if (!withdrawalsDisabled()) return null;
  return Response.json(
    { error: "Withdrawals are temporarily disabled while we complete a security review. Your balance is safe." },
    { status: 503 },
  );
}
