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

export const DEFAULT_RANGE: AdminRange = "today";
