"use client";

import {
  siVisa, siMastercard, siAmericanexpress, siApplepay, siGooglepay, siPaypal,
  siAirtel, siOrange, siPix, siAlipay, siWechat, siPaytm, siPhonepe,
  siBitcoin, siEthereum, siTether, siWise, siRevolut, siCashapp, siVenmo,
  siSepa, siPayoneer, siZelle, siVodafone, type SimpleIcon,
} from "simple-icons";
import { Icon } from "@/components/icon";
import { methodCategory, methodLabel } from "@/lib/payments/method-registry";
import { badgeColor } from "@/lib/p2p/payment-methods";

const CDN = "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color";

/** Official coin marks (cryptocurrency-icons). */
export const COIN_URL: Record<string, string> = {
  USDT: `${CDN}/usdt.svg`,
  USDC: `${CDN}/usdc.svg`,
  BTC:  `${CDN}/btc.svg`,
  ETH:  `${CDN}/eth.svg`,
  BNB:  `${CDN}/bnb.svg`,
  TRX:  `${CDN}/trx.svg`,
  POL:  `${CDN}/matic.svg`,
  MATIC: `${CDN}/matic.svg`,
  SOL:  `${CDN}/sol.svg`,
  LTC:  `${CDN}/ltc.svg`,
  XRP:  `${CDN}/xrp.svg`,
  DOGE: `${CDN}/doge.svg`,
  BCH:  `${CDN}/bch.svg`,
  DAI:  `${CDN}/dai.svg`,
  LINK: `${CDN}/link.svg`,
  WBTC: `${CDN}/wbtc.svg`,
  BUSD: `${CDN}/busd.svg`,
};

/** Simple Icons brands we ship as authentic marks. */
const SI: Record<string, SimpleIcon> = {
  VISA: siVisa,
  MASTERCARD: siMastercard,
  MC: siMastercard,
  AMEX: siAmericanexpress,
  APPLE_PAY: siApplepay,
  GOOGLE_PAY: siGooglepay,
  PAYPAL: siPaypal,
  AIRTEL: siAirtel,
  ORANGE_MONEY: siOrange,
  PIX: siPix,
  ALIPAY: siAlipay,
  WECHAT: siWechat,
  PAYTM: siPaytm,
  PHONEPE: siPhonepe,
  BTC: siBitcoin,
  ETH: siEthereum,
  USDT: siTether,
  WISE: siWise,
  REVOLUT: siRevolut,
  CASHAPP: siCashapp,
  VENMO: siVenmo,
  SEPA: siSepa,
  PAYONEER: siPayoneer,
  ZELLE: siZelle,
  VODAFONE_CASH: siVodafone,
};

/** Self-hosted marks for brands Simple Icons lacks. */
const LOCAL_SVG: Record<string, { bg: string; fg: string; monogram: string }> = {
  MTN_MOMO: { bg: "#FFCC00", fg: "#000000", monogram: "MTN" },
  UPI: { bg: "#097939", fg: "#ffffff", monogram: "UPI" },
  BKASH: { bg: "#E2136E", fg: "#ffffff", monogram: "bK" },
  TELEBIRR: { bg: "#00833E", fg: "#ffffff", monogram: "Tb" },
  NAGAD: { bg: "#F6921E", fg: "#ffffff", monogram: "Ng" },
};

function contrastOn(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.65 ? "#0b0b12" : "#ffffff";
}

function categoryGlyph(code: string): string {
  switch (methodCategory(code)) {
    case "Bank":         return "account_balance";
    case "Mobile Money": return "phone_iphone";
    case "Cards":        return "credit_card";
    case "Crypto":       return "currency_bitcoin";
    case "Cash":         return "payments";
    default:             return "account_balance_wallet";
  }
}

type Props = {
  code: string;
  size?: number;
  className?: string;
};

/** Stack of live coin marks for the single "Crypto" payment method row. */
function CryptoMethodMark({ size, className }: { size: number; className: string }) {
  const stack = ["USDT", "BTC", "TRX"] as const;
  const icon = Math.round(size * 0.72);
  const overlap = Math.round(icon * 0.38);
  const width = icon + overlap * (stack.length - 1);
  return (
    <span
      className={`relative shrink-0 ${className}`}
      style={{ width, height: size }}
      title="Crypto"
    >
      {stack.map((code, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={code}
          src={COIN_URL[code]}
          alt=""
          width={icon}
          height={icon}
          className="absolute top-1/2 rounded-full bg-[#151518] object-contain ring-1 ring-[#151518]"
          style={{
            width: icon,
            height: icon,
            left: i * overlap,
            transform: "translateY(-50%)",
            zIndex: stack.length - i,
          }}
        />
      ))}
    </span>
  );
}

/**
 * Professional payment-brand mark for wallet + P2P.
 * Priority: coin CDN → local SVG → Simple Icons → coloured category tile.
 */
export function PaymentBrandLogo({ code, size = 32, className = "" }: Props) {
  const key = code === "MC" ? "MASTERCARD" : code;
  const title = methodLabel(key);

  if (key === "MPESA") {
    return (
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        className={`shrink-0 rounded-lg ${className}`}
        style={{ width: size, height: size }}
      >
        <rect width="32" height="32" rx="6" fill="#43b02a" />
        <text
          x="16"
          y="19"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontWeight="900"
          fontStyle="italic"
          fontSize="7"
          textAnchor="middle"
          letterSpacing="-0.3"
        >
          <tspan fill="#e30613">M</tspan>
          <tspan fill="#ffffff">-PESA</tspan>
        </text>
      </svg>
    );
  }

  if (key === "CRYPTO") {
    return <CryptoMethodMark size={size} className={className} />;
  }

  const coin = COIN_URL[key];
  if (coin) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coin}
        alt={title}
        width={size}
        height={size}
        className={`shrink-0 rounded-lg bg-white/[0.06] object-contain p-1 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const local = LOCAL_SVG[key];
  if (local) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg font-black ${className}`}
        style={{
          width: size,
          height: size,
          background: local.bg,
          color: local.fg,
          fontSize: Math.max(9, Math.round(size * (local.monogram.length > 2 ? 0.28 : 0.42))),
        }}
        title={title}
      >
        {local.monogram}
      </span>
    );
  }

  const brand = SI[key];
  if (brand) {
    const bg = `#${brand.hex}`;
    const fg = contrastOn(brand.hex);
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg ${className}`}
        style={{ width: size, height: size, background: bg }}
        title={brand.title}
      >
        <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill={fg} aria-hidden>
          <path d={brand.path} />
        </svg>
      </span>
    );
  }

  if (key === "BANK" || key === "SWIFT") {
    return (
      <span
        className={`grid shrink-0 place-items-center rounded-lg bg-white/[0.08] text-slate-200 ${className}`}
        style={{ width: size, height: size }}
        title={title}
      >
        <Icon name="account_balance" size={Math.round(size * 0.5)} />
      </span>
    );
  }

  const bg = badgeColor(key);
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg text-white ${className}`}
      style={{ width: size, height: size, background: bg }}
      title={title}
    >
      <Icon name={categoryGlyph(key)} size={Math.round(size * 0.5)} />
    </span>
  );
}

/** @deprecated Prefer PaymentBrandLogo — kept for P2P import compatibility. */
export { PaymentBrandLogo as PaymentLogo };
