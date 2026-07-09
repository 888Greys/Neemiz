/**
 * Deterministic professional avatar for P2P merchants.
 * Uses DiceBear Notionists (CDN) when no uploaded photo — no npm dep.
 * Same seed always returns the same face.
 */
export function merchantAvatarUrl(
  seed: string,
  opts?: { size?: number },
): string {
  const size = opts?.size ?? 64;
  const s = encodeURIComponent(seed.trim() || "merchant");
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${s}&size=${size}&backgroundColor=1a1b22`;
}
