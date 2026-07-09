/**
 * Deterministic business-style avatar for P2P traders.
 * Prefer the account photo (Google / email / uploaded) when the API sends one;
 * otherwise DiceBear Personas (CDN) — flat professional people, not anime.
 * Same seed always returns the same face.
 */
export function merchantAvatarUrl(
  seed: string,
  opts?: { size?: number },
): string {
  const size = opts?.size ?? 64;
  const s = encodeURIComponent(seed.trim() || "merchant");
  // Personas = Draftbit business/product people (suits, glasses, varied ages).
  return `https://api.dicebear.com/9.x/personas/svg?seed=${s}&size=${size}&backgroundColor=1a1b22`;
}
