/**
 * P2P payment-reference validation (2026-07-20 hardening).
 *
 * Incident: ring accounts marked P2P orders "paid" with an EMPTY payment
 * reference (no M-Pesa ever sent), then self-released the escrow from a linked
 * merchant account. An empty or implausible reference must now be impossible
 * at mark-paid time.
 */

/** Safaricom M-Pesa confirmation codes: 10 chars, start with a letter, uppercase alnum. */
export const MPESA_REF_PATTERN = /^[A-Z][A-Z0-9]{9}$/;

/** Bank / other rails: free-form but must look like a real reference (6+ chars). */
export const GENERIC_REF_PATTERN = /^[A-Z0-9][A-Z0-9\-/]{5,}$/;

/** Normalize a user-typed reference for validation + storage (trim, uppercase). */
export function normalizePaymentRef(ref: string | null | undefined): string {
  return (ref ?? "").trim().toUpperCase();
}

export function isValidPaymentRef(ref: string | null | undefined, paymentMethod?: string | null): boolean {
  const r = normalizePaymentRef(ref);
  if (!r) return false;
  const method = (paymentMethod ?? "").trim().toUpperCase();
  if (method === "MPESA" || method === "M-PESA") return MPESA_REF_PATTERN.test(r);
  return GENERIC_REF_PATTERN.test(r);
}

/** User-facing error for a missing/invalid reference, tailored to the rail. */
export function paymentRefError(paymentMethod?: string | null): string {
  const method = (paymentMethod ?? "").trim().toUpperCase();
  if (method === "MPESA" || method === "M-PESA") {
    return "Enter the 10-character M-Pesa confirmation code (e.g. SDA4K2X9PT). Payment cannot be marked without it.";
  }
  return "Enter the payment reference from your bank/provider receipt. Payment cannot be marked without it.";
}
