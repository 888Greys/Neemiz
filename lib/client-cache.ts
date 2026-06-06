const store = new Map<string, { data: unknown; ts: number }>();
const TTL = 30_000;
const STORAGE_PREFIX = "nezeem-cache:";

function readStored<T>(key: string): { data: T; ts: number } | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return undefined;
    return JSON.parse(raw) as { data: T; ts: number };
  } catch {
    return undefined;
  }
}

export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key) ?? readStored<T>(key);
  if (entry) {
    store.set(key, entry);
    return entry.data as T;
  }
  return undefined;
}

export function isCacheFresh(key: string): boolean {
  const entry = store.get(key) ?? readStored(key);
  return !!entry && Date.now() - entry.ts < TTL;
}

export function setCached(key: string, data: unknown): void {
  const entry = { data, ts: Date.now() };
  store.set(key, entry);
  if (typeof window !== "undefined") {
    try { sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry)); } catch { /* ignore quota */ }
  }
}

export function invalidate(key: string): void {
  store.delete(key);
  if (typeof window !== "undefined") sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`);
}

export async function cachedFetch<T>(key: string, refresh = false): Promise<T | undefined> {
  const hit = getCached<T>(key);
  if (!refresh && hit !== undefined) return hit;
  try {
    const res = await fetch(key);
    if (!res.ok) return hit;
    const data = await res.json() as T;
    setCached(key, data);
    return data;
  } catch {
    return hit;
  }
}
