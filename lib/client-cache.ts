const store = new Map<string, { data: unknown; ts: number }>();
const TTL = 30_000;

export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (entry && Date.now() - entry.ts < TTL) return entry.data as T;
  return undefined;
}

export function setCached(key: string, data: unknown): void {
  store.set(key, { data, ts: Date.now() });
}

export function invalidate(key: string): void {
  store.delete(key);
}

export async function cachedFetch<T>(key: string, refresh = false): Promise<T | undefined> {
  if (!refresh) {
    const hit = getCached<T>(key);
    if (hit !== undefined) return hit;
  }
  try {
    const res = await fetch(key);
    if (!res.ok) return undefined;
    const data = await res.json() as T;
    setCached(key, data);
    return data;
  } catch {
    return undefined;
  }
}
