// Client-safe canonical admin time-range vocabulary. No server imports, so both
// the UI (<RangeTabs>) and the APIs (via rangeWindow in metrics.ts) share one
// source of truth for which ranges exist and what they're labelled.
export const ADMIN_RANGES = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["7d", "7d"],
  ["30d", "30d"],
  ["mtd", "MTD"],
  ["all", "All"],
] as const;

export type AdminRange = (typeof ADMIN_RANGES)[number][0];

// A specific Nairobi calendar day, e.g. "day:2026-06-25". Selected via the
// calendar picker rather than the preset tabs, but understood everywhere the
// preset tokens are (rangeWindow on the server, the filter UI on the client).
export type DayRange = `day:${string}`;
export type AdminRangeValue = AdminRange | DayRange;

export const DEFAULT_RANGE: AdminRange = "today";

export const isDayRange = (r: string): r is DayRange => r.startsWith("day:");

/** The `YYYY-MM-DD` inside a day token (or "" if it isn't one). */
export const dayOf = (r: string): string => (isDayRange(r) ? r.slice(4) : "");

/** Human label for any range token, for headers and the picker button. */
export function rangeLabel(r: string): string {
  if (isDayRange(r)) {
    const d = new Date(`${dayOf(r)}T00:00:00`);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  return ADMIN_RANGES.find(([t]) => t === r)?.[1] ?? r;
}
