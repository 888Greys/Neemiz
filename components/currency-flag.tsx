import type { DisplayCurrency } from "@/lib/currency-config";

/**
 * Real flag image for a currency (emoji flags don't render on Windows — they
 * show as bare letters). Uses flagcdn SVGs; USDT/crypto gets a ₮ coin badge.
 */
export function CurrencyFlag({ currency, size = 16 }: { currency: DisplayCurrency; size?: number }) {
  if (currency.kind === "crypto" || !currency.cc) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-500 font-black text-white"
        style={{ width: size, height: size, fontSize: size * 0.62 }}
        aria-hidden
      >
        ₮
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/${currency.cc}.svg`}
      alt={`${currency.code} flag`}
      width={Math.round(size * 1.33)}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-[2px] object-cover ring-1 ring-black/10"
      style={{ width: Math.round(size * 1.33), height: size }}
    />
  );
}
