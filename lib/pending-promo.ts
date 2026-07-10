/** Client helpers for applying a promo after signup / OAuth. */

const STORAGE_KEY = "nezeem_pending_promo";

export function stashPendingPromo(code: string) {
  const trimmed = code.trim().toUpperCase().replace(/\s+/g, "");
  if (!trimmed) {
    clearPendingPromo();
    return;
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // private mode / blocked storage — ignore
  }
}

export function peekPendingPromo(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingPromo() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Redeem a pending or explicit code. Returns amount credited, or null on skip/fail. */
export async function redeemPromoClient(code?: string | null): Promise<{
  ok: boolean;
  amount?: number;
  error?: string;
}> {
  const value = (code ?? peekPendingPromo() ?? "").trim();
  if (!value) return { ok: false, error: "No code" };

  try {
    const res = await fetch("/api/promo/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: value }),
    });
    const data = await res.json().catch(() => ({})) as {
      ok?: boolean;
      amount?: number;
      error?: string;
    };
    if (res.ok && data.ok) {
      clearPendingPromo();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("wallet-refresh"));
      }
      return { ok: true, amount: data.amount };
    }
    // Already used / invalid — clear so we don't keep retrying on every load.
    if (res.status === 409 || res.status === 404 || res.status === 410) {
      clearPendingPromo();
    }
    return { ok: false, error: data.error ?? "Could not apply promo code" };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
