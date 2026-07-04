import {
  siAirtel, siVodafone, siOrange, siPaypal, siWise, siRevolut, siPayoneer,
  siZelle, siCashapp, siVenmo, siAlipay, siWechat, siPaytm, siPhonepe, siPix,
  type SimpleIcon,
} from "simple-icons";
import { Icon } from "@/components/icon";
import { badgeColor, paymentMethodCategory } from "@/lib/p2p/payment-methods";

// Authentic brand marks (simple-icons) for the methods it covers. Everything
// else falls back to a brand-coloured tile with a category glyph — never bare
// initials.
const BRAND: Record<string, SimpleIcon> = {
  AIRTEL: siAirtel, VODAFONE_CASH: siVodafone, ORANGE_MONEY: siOrange,
  PAYPAL: siPaypal, WISE: siWise, REVOLUT: siRevolut, PAYONEER: siPayoneer,
  ZELLE: siZelle, CASHAPP: siCashapp, VENMO: siVenmo, ALIPAY: siAlipay,
  WECHAT: siWechat, PAYTM: siPaytm, PHONEPE: siPhonepe, PIX: siPix,
};

// Fallback glyph by category so a logo-less method still reads as an icon.
function categoryGlyph(code: string): string {
  switch (paymentMethodCategory(code)) {
    case "Bank":               return "account_balance";
    case "Mobile Money":       return "phone_iphone";
    case "Cash":               return "payments";
    default:                   return "account_balance_wallet"; // wallets/neobanks/online
  }
}

// Pick a legible glyph colour (dark on light brand tiles, white on dark ones).
function contrastOn(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.65 ? "#0b0b12" : "#ffffff";
}

export function PaymentLogo({ code, size = 22 }: { code: string; size?: number }) {
  const brand = BRAND[code];
  if (brand) {
    const bg = `#${brand.hex}`;
    const fg = contrastOn(brand.hex);
    return (
      <span className="flex shrink-0 items-center justify-center rounded-md" style={{ width: size, height: size, background: bg }} title={brand.title}>
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill={fg} aria-hidden="true">
          <path d={brand.path} />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center justify-center rounded-md text-white" style={{ width: size, height: size, background: badgeColor(code) }}>
      <Icon name={categoryGlyph(code)} size={Math.round(size * 0.56)} />
    </span>
  );
}
