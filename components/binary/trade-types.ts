// Deriv-style trade-type catalogue for the Binary trader. Drives the trade-type
// picker popover and the per-type right-hand panel. UI metadata only — settlement
// logic lives server-side per type as we wire each one up.

export type TradeCategory = "all" | "digits" | "multipliers" | "options" | "accumulators";

export type TradeTypeId =
  | "accumulators"
  | "vanillas"        // Call/Put
  | "turbos"
  | "multipliers"
  | "rise_fall"
  | "higher_lower"
  | "touch_no_touch"
  | "matches_differs"
  | "even_odd"
  | "over_under";

export interface TradeType {
  id:        TradeTypeId;
  label:     string;
  group:     string;          // section heading in the picker
  categories: TradeCategory[]; // which left-rail filters include it
  upIcon:    string;          // material icon for the bullish/up action
  downIcon:  string;          // material icon for the bearish/down action
}

// Ordered as they appear in the picker's "All" list.
export const TRADE_TYPES: TradeType[] = [
  { id: "accumulators",   label: "Accumulators",   group: "Accumulators",     categories: ["all", "accumulators"],          upIcon: "show_chart",     downIcon: "show_chart" },
  { id: "vanillas",       label: "Call/Put",       group: "Vanillas",         categories: ["all", "options"],               upIcon: "trending_up",    downIcon: "trending_down" },
  { id: "turbos",         label: "Turbos",         group: "Turbos",           categories: ["all", "multipliers"],           upIcon: "trending_up",    downIcon: "trending_down" },
  { id: "multipliers",    label: "Multipliers",    group: "Multipliers",      categories: ["all", "multipliers"],           upIcon: "trending_up",    downIcon: "trending_down" },
  { id: "rise_fall",      label: "Rise/Fall",      group: "Ups & Downs",      categories: ["all", "options"],               upIcon: "trending_up",    downIcon: "trending_down" },
  { id: "higher_lower",   label: "Higher/Lower",   group: "Ups & Downs",      categories: ["all", "options"],               upIcon: "trending_up",    downIcon: "trending_down" },
  { id: "touch_no_touch", label: "Touch/No Touch", group: "Touch & No Touch", categories: ["all", "options"],               upIcon: "trending_up",    downIcon: "trending_down" },
  { id: "matches_differs",label: "Matches/Differs",group: "Digits",           categories: ["all", "options", "digits"],     upIcon: "trending_up",    downIcon: "trending_down" },
  { id: "even_odd",       label: "Even/Odd",       group: "Digits",           categories: ["all", "options", "digits"],     upIcon: "trending_up",    downIcon: "trending_down" },
  { id: "over_under",     label: "Over/Under",     group: "Digits",           categories: ["all", "options", "digits"],     upIcon: "trending_up",    downIcon: "trending_down" },
];

export const TRADE_CATEGORIES: { id: TradeCategory; label: string; icon: string }[] = [
  { id: "all",          label: "All",          icon: "grid_view" },
  { id: "digits",       label: "Digits",       icon: "analytics" },
  { id: "multipliers",  label: "Multipliers",  icon: "bolt" },
  { id: "options",      label: "Options",      icon: "swap_horiz" },
  { id: "accumulators", label: "Accumulators", icon: "show_chart" },
];

export function tradeTypeById(id: TradeTypeId): TradeType {
  return TRADE_TYPES.find((t) => t.id === id) ?? TRADE_TYPES[0];
}

// Which trade types are fully wired vs. still UI-only (shows a "coming soon"
// stub in the panel). Update as each type's settlement lands.
export const IMPLEMENTED_TYPES: Set<TradeTypeId> = new Set([
  "accumulators",
  "matches_differs",
  "even_odd",
  "over_under",
  "rise_fall",
  "higher_lower",
  "touch_no_touch",
  "vanillas",
  "multipliers",
  "turbos",
]);
