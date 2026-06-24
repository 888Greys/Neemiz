// Synthetic-index market icon in the familiar candlestick visual language — a
// mini candlestick glyph + the volatility number + a "1s" flash badge. Drawn
// from scratch (no third-party brand artwork) so it's safe to ship and themeable.

// Per-index palette so each volatility tier reads at a glance (Deriv-style).
// [base candle, bright candle, tinted tile-gradient top]. Falls back to teal.
const INDEX_THEME: Record<string, [string, string, string]> = {
  "10":  ["#2ec4b6", "#5ee0d3", "#11242a"], // teal
  "25":  ["#3b82f6", "#73a8ff", "#13202f"], // blue
  "50":  ["#8b5cf6", "#b794ff", "#1d1830"], // violet
  "75":  ["#f59e0b", "#ffc24d", "#2a2110"], // amber
  "100": ["#ec4899", "#ff79bd", "#2c1320"], // pink/magenta
};

export function MarketIcon({
  symbol,
  size = 36,
  className = "",
}: {
  symbol: string;
  size?: number;
  className?: string;
}) {
  const num = symbol.match(/\d+/)?.[0] ?? "";
  const fast = symbol.includes("1s");
  const [base, bright, tileTop] = INDEX_THEME[num] ?? ["#2ec4b6", "#5ee0d3", "#16232f"];

  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        className="block h-full w-full overflow-hidden rounded-lg ring-1 ring-white/10"
        style={{ background: `linear-gradient(155deg,${tileTop} 0%,#0c141c 100%)` }}
      >
        <svg viewBox="0 0 40 40" className="h-full w-full" fill="none" aria-hidden>
          {/* wicks */}
          <g stroke={base} strokeWidth="1.4" strokeLinecap="round" opacity="0.85">
            <line x1="11" y1="13" x2="11" y2="30" />
            <line x1="20" y1="8" x2="20" y2="25" />
            <line x1="29" y1="15" x2="29" y2="33" />
          </g>
          {/* bodies — tinted by the index for an at-a-glance identity */}
          <rect x="8.5" y="17.5" width="5" height="8.5" rx="1.2" fill={base} />
          <rect x="17.5" y="11" width="5" height="10.5" rx="1.2" fill={bright} />
          <rect x="26.5" y="20" width="5" height="9" rx="1.2" fill={base} opacity="0.7" />
        </svg>
      </span>

      {num && (
        <span
          className="absolute left-1 top-0.5 font-black leading-none text-white/90"
          style={{ fontSize: Math.max(7, size * 0.22), textShadow: "0 1px 2px rgba(0,0,0,.85)" }}
        >
          {num}
        </span>
      )}
      {fast && (
        <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 text-[7px] font-black leading-[1.5] text-white shadow ring-1 ring-[#0c141c]">
          1s
        </span>
      )}
    </span>
  );
}
