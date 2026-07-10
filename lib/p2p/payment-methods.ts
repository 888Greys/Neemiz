// ─── Region-specific P2P payment methods ──────────────────────────────────────
// Maps each supported fiat to the local payment rails people actually use, so
// the browse filter and the merchant ad form feel native per country — like
// Binance P2P. `value` is the code stored on P2PAd.paymentMethods; `label` is
// what users see.

import { MARKETS } from "@/lib/payments/country-methods";
import { methodLabel } from "@/lib/payments/method-registry";

export interface PaymentMethod {
  value: string;
  label: string;
  category?: string; // for grouping in the picker (optgroup)
}

// ─── Global payment-method catalogue (Binance-P2P style) ──────────────────────
// The full set a merchant can attach to their profile / pick on an ad,
// regardless of fiat. Grouped by category for the picker. `value` is the stored
// code; keep codes STABLE (changing one orphans existing ads/methods).
export const GLOBAL_PAYMENT_METHODS: PaymentMethod[] = [
  // Mobile money
  { value: "MPESA",        label: "M-Pesa",            category: "Mobile Money" },
  { value: "AIRTEL",       label: "Airtel Money",      category: "Mobile Money" },
  { value: "MTN_MOMO",     label: "MTN MoMo",          category: "Mobile Money" },
  { value: "VODAFONE_CASH",label: "Vodafone Cash",     category: "Mobile Money" },
  { value: "TIGO_PESA",    label: "Tigo Pesa",         category: "Mobile Money" },
  { value: "ORANGE_MONEY", label: "Orange Money",      category: "Mobile Money" },
  { value: "MOOV_MONEY",   label: "Moov Money",        category: "Mobile Money" },
  { value: "WAVE",         label: "Wave",              category: "Mobile Money" },
  { value: "ECOCASH",      label: "EcoCash",           category: "Mobile Money" },
  { value: "MPAMBA",       label: "Airtel/Mpamba",     category: "Mobile Money" },
  { value: "TELEBIRR",     label: "Telebirr",          category: "Mobile Money" },
  { value: "TELECEL",      label: "Telecel Cash",      category: "Mobile Money" },
  { value: "MOBILE_MONEY", label: "Mobile Money",      category: "Mobile Money" },
  { value: "GCASH",        label: "GCash",             category: "Mobile Money" },
  { value: "MAYA",         label: "Maya (PayMaya)",    category: "Mobile Money" },
  { value: "JAZZCASH",     label: "JazzCash",          category: "Mobile Money" },
  { value: "EASYPAISA",    label: "Easypaisa",         category: "Mobile Money" },
  { value: "BKASH",        label: "bKash",             category: "Mobile Money" },
  { value: "NAGAD",        label: "Nagad",             category: "Mobile Money" },
  { value: "ROCKET",       label: "Rocket",            category: "Mobile Money" },
  { value: "FAWRY",        label: "Fawry",             category: "Mobile Money" },
  { value: "MOBILEPAY",    label: "MobilePay",         category: "Mobile Money" },
  // Nigeria neobanks/wallets
  { value: "OPAY",         label: "Opay",              category: "Wallets & Neobanks" },
  { value: "PALMPAY",      label: "PalmPay",           category: "Wallets & Neobanks" },
  { value: "KUDA",         label: "Kuda Bank",         category: "Wallets & Neobanks" },
  { value: "MONIEPOINT",   label: "Moniepoint",        category: "Wallets & Neobanks" },
  // Online wallets
  { value: "PAYPAL",       label: "PayPal",            category: "Online Wallets" },
  { value: "WISE",         label: "Wise",              category: "Online Wallets" },
  { value: "REVOLUT",      label: "Revolut",           category: "Online Wallets" },
  { value: "SKRILL",       label: "Skrill",            category: "Online Wallets" },
  { value: "NETELLER",     label: "Neteller",          category: "Online Wallets" },
  { value: "PAYONEER",     label: "Payoneer",          category: "Online Wallets" },
  { value: "APPLE_PAY",    label: "Apple Pay",         category: "Online Wallets" },
  { value: "GOOGLE_PAY",   label: "Google Pay",        category: "Online Wallets" },
  { value: "ZELLE",        label: "Zelle",             category: "Online Wallets" },
  { value: "CASHAPP",      label: "Cash App",          category: "Online Wallets" },
  { value: "VENMO",        label: "Venmo",             category: "Online Wallets" },
  { value: "PAPARA",       label: "Papara",            category: "Online Wallets" },
  { value: "ALIPAY",       label: "Alipay",            category: "Online Wallets" },
  { value: "WECHAT",       label: "WeChat Pay",        category: "Online Wallets" },
  { value: "PAYTM",        label: "Paytm",             category: "Online Wallets" },
  { value: "PHONEPE",      label: "PhonePe",           category: "Online Wallets" },
  { value: "TRUEMONEY",    label: "TrueMoney",         category: "Online Wallets" },
  { value: "DANA",         label: "DANA",              category: "Online Wallets" },
  { value: "OVO",          label: "OVO",               category: "Online Wallets" },
  { value: "GOPAY",        label: "GoPay",             category: "Online Wallets" },
  { value: "GRABPAY",      label: "GrabPay",           category: "Online Wallets" },
  { value: "TNG",          label: "Touch 'n Go",       category: "Online Wallets" },
  { value: "MERCADOPAGO",  label: "Mercado Pago",      category: "Online Wallets" },
  { value: "NEQUI",        label: "Nequi",             category: "Online Wallets" },
  { value: "DAVIPLATA",    label: "Daviplata",         category: "Online Wallets" },
  { value: "KASPI",        label: "Kaspi Pay",         category: "Online Wallets" },
  { value: "PAYPAY",       label: "PayPay",            category: "Online Wallets" },
  { value: "LINE_PAY",     label: "LINE Pay",          category: "Online Wallets" },
  // Cards (P2P peer rails)
  { value: "VISA",         label: "Visa",              category: "Cards" },
  { value: "MASTERCARD",   label: "Mastercard",        category: "Cards" },
  { value: "AMEX",         label: "American Express",  category: "Cards" },
  { value: "UNIONPAY",     label: "UnionPay",          category: "Cards" },
  { value: "RUPAY",        label: "RuPay",             category: "Cards" },
  { value: "MEEZA",        label: "Meeza",             category: "Cards" },
  // Bank rails
  { value: "BANK",         label: "Bank Transfer",     category: "Bank" },
  { value: "SEPA",         label: "SEPA",              category: "Bank" },
  { value: "SWIFT",        label: "SWIFT / Wire",      category: "Bank" },
  { value: "UPI",          label: "UPI",               category: "Bank" },
  { value: "IMPS",         label: "IMPS",              category: "Bank" },
  { value: "PIX",          label: "Pix",               category: "Bank" },
  { value: "SPEI",         label: "SPEI",              category: "Bank" },
  { value: "FPX",          label: "FPX",               category: "Bank" },
  { value: "DUITNOW",      label: "DuitNow",           category: "Bank" },
  { value: "QRIS",         label: "QRIS",              category: "Bank" },
  { value: "PSE",          label: "PSE",               category: "Bank" },
  { value: "INTERAC",      label: "Interac",           category: "Bank" },
  { value: "BANCONTACT",   label: "Bancontact",        category: "Bank" },
  { value: "IDEAL",        label: "iDEAL",             category: "Bank" },
  { value: "KNET",         label: "KNET",              category: "Bank" },
  { value: "CLIQ",         label: "CliQ",              category: "Bank" },
  { value: "FNB",          label: "FNB",               category: "Bank" },
  { value: "CAPITEC",      label: "Capitec",           category: "Bank" },
  { value: "SBERBANK",     label: "Sberbank",          category: "Bank" },
  { value: "TINKOFF",      label: "Tinkoff",           category: "Bank" },
  // Cash
  { value: "CASH_DEPOSIT", label: "Cash Deposit",      category: "Cash" },
  { value: "CASH_PERSON",  label: "Cash in Person",    category: "Cash" },
];

/** P2P local rails by fiat — seeded from the international market catalogue. */
export const PAYMENT_METHODS_BY_FIAT: Record<string, PaymentMethod[]> = Object.fromEntries(
  MARKETS.map((m) => [
    m.currency,
    m.methods
      .filter((code) => !["USDT", "BTC", "ETH", "USDC", "CRYPTO"].includes(code))
      .map((code) => ({ value: code, label: methodLabel(code) })),
  ]),
);

const FALLBACK: PaymentMethod[] = [{ value: "BANK", label: "Bank Transfer" }];

/** Local payment methods for a fiat (falls back to KES, then bank-only). */
export function paymentMethodsForFiat(fiat: string | null | undefined): PaymentMethod[] {
  return (fiat && PAYMENT_METHODS_BY_FIAT[fiat]) || PAYMENT_METHODS_BY_FIAT.KES || FALLBACK;
}

// Global rails that aren't tied to one country, so they're valid to offer with
// any fiat (a merchant can accept a bank wire or PayPal regardless of currency).
const UNIVERSAL_METHODS = new Set([
  "BANK", "SWIFT", "WISE", "PAYPAL", "REVOLUT", "SKRILL", "NETELLER",
  "PAYONEER", "CASH_DEPOSIT", "CASH_PERSON",
]);

/**
 * Whether a stored payment-method code makes sense for a given fiat. True for
 * the fiat's local rails and for the universal (country-agnostic) methods, so
 * e.g. M-Pesa is hidden on an NGN ad but Bank Transfer stays available.
 *
 * - No fiat (null/undefined): no country context, so don't filter (return true).
 * - A selected fiat we DON'T have local rails for (e.g. CAD, CNY, JPY): only the
 *   universal rails apply — country-specific methods like M-Pesa must NOT show,
 *   which is exactly the "why is M-Pesa showing when I picked CAD" bug.
 * - A mapped fiat: its local rails + the universal ones.
 */
export function methodAllowedForFiat(code: string, fiat: string | null | undefined): boolean {
  if (!fiat) return true;
  if (UNIVERSAL_METHODS.has(code)) return true;
  const local = PAYMENT_METHODS_BY_FIAT[fiat];
  if (!local) return false; // selected but unmapped currency → universal rails only
  return local.some((m) => m.value === code);
}

// ─── Per-method display helpers (field label + badge) ─────────────────────────

// The account identifier a given rail actually uses, so the input label matches
// the selected method (PayPal wants an email, UPI a VPA, banks an account no.).
const EMAIL_METHODS   = new Set(["PAYPAL", "SKRILL", "NETELLER", "WISE", "PAYONEER"]);
const HANDLE_METHODS: Record<string, string> = {
  ZELLE: "Email or phone", CASHAPP: "$Cashtag", VENMO: "@username",
  UPI: "UPI ID", REVOLUT: "@RevTag or phone", ALIPAY: "Alipay ID / phone",
  WECHAT: "WeChat ID / phone",
};
// code → category, for label + fallback-glyph decisions.
const CATEGORY_BY_CODE: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const pm of GLOBAL_PAYMENT_METHODS) m[pm.value] = pm.category ?? "Other";
  return m;
})();

export function paymentMethodCategory(code: string): string {
  return CATEGORY_BY_CODE[code] ?? "Other";
}

/** Placeholder/label for the "account identifier" field, per method + category. */
export function accountIdentifierLabel(code: string): string {
  if (EMAIL_METHODS.has(code)) return "Email";
  if (HANDLE_METHODS[code]) return HANDLE_METHODS[code];
  switch (paymentMethodCategory(code)) {
    case "Bank":               return "Account number";
    case "Mobile Money":       return "Phone number";
    case "Wallets & Neobanks": return "Account or phone";
    case "Online Wallets":     return "Email or phone";
    case "Cash":               return "Location / details";
    default:                   return "Phone / Paybill";
  }
}

// Brand accent colours for the picker's monogram badges (recognisable at a
// glance without shipping ~45 brand SVGs). Anything not listed gets a stable
// hash colour from badgeColor().
const BRAND_COLORS: Record<string, string> = {
  MPESA: "#43b02a", AIRTEL: "#e40000", MTN_MOMO: "#ffcb05", VODAFONE_CASH: "#e60000",
  TIGO_PESA: "#00a1e0", ORANGE_MONEY: "#ff7900", WAVE: "#1dc4ff", MPAMBA: "#e40000",
  TELEBIRR: "#00833e", TELECEL: "#e30613", MOBILE_MONEY: "#0ea5e9",
  GCASH: "#0057ff", MAYA: "#28e07b", JAZZCASH: "#b01e2e", EASYPAISA: "#00b04f",
  BKASH: "#e2136e", NAGAD: "#f6921e", ROCKET: "#8c1d40", FAWRY: "#e30613",
  OPAY: "#1dd05d", PALMPAY: "#6c2bd9", KUDA: "#40196d", MONIEPOINT: "#0357ee",
  PAYPAL: "#0070ba", WISE: "#9fe870", REVOLUT: "#0666eb", SKRILL: "#862165",
  NETELLER: "#83ba3b", PAYONEER: "#ff4800", APPLE_PAY: "#000000", GOOGLE_PAY: "#4285f4",
  ZELLE: "#6d1ed4", CASHAPP: "#00d64f", VENMO: "#008cff", ALIPAY: "#1677ff",
  WECHAT: "#07c160", PAYTM: "#00baf2", PHONEPE: "#5f259f", GRABPAY: "#00b14f",
  MERCADOPAGO: "#009ee3", NEQUI: "#200020", KASPI: "#f14635",
  VISA: "#1a1f71", MASTERCARD: "#eb001b", AMEX: "#2e77bc", UNIONPAY: "#e21836",
  RUPAY: "#097939", MEEZA: "#c8102e",
  BANK: "#64748b", SEPA: "#0b57d0", SWIFT: "#334155", UPI: "#097939",
  IMPS: "#0b57d0", PIX: "#32bcad", SPEI: "#006847", FPX: "#ed1c24",
  DUITNOW: "#ed1c24", QRIS: "#ed1c24", PSE: "#00a859", INTERAC: "#fdb913",
  BANCONTACT: "#005498", IDEAL: "#cc0066", KNET: "#007a3d", CLIQ: "#c8102e",
  FNB: "#00a2a4", CAPITEC: "#004b8d",
  CASH_DEPOSIT: "#f59e0b", CASH_PERSON: "#f59e0b",
};

/** Accent colour for a method's badge (brand colour when known, else hashed). */
export function badgeColor(code: string): string {
  if (BRAND_COLORS[code]) return BRAND_COLORS[code];
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 55% 45%)`;
}

/** Short 1–2 char monogram for a method's badge. */
export function badgeMonogram(code: string): string {
  const label = paymentMethodLabel(code).replace(/[^A-Za-z0-9 ]/g, "").trim();
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

// Flat code → label lookup for displaying a stored method code anywhere.
const ALL_LABELS: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const pm of GLOBAL_PAYMENT_METHODS) m[pm.value] = pm.label;
  for (const list of Object.values(PAYMENT_METHODS_BY_FIAT)) {
    for (const pm of list) m[pm.value] = pm.label;
  }
  return m;
})();

/** All selectable payment methods, grouped by category (for the picker). */
export function paymentMethodsByCategory(): Record<string, PaymentMethod[]> {
  const out: Record<string, PaymentMethod[]> = {};
  for (const pm of GLOBAL_PAYMENT_METHODS) {
    const cat = pm.category ?? "Other";
    (out[cat] ??= []).push(pm);
  }
  return out;
}

export function paymentMethodLabel(code: string): string {
  return ALL_LABELS[code] ?? code;
}

/** Every known method code — used to validate URL/query params. */
export const ALL_PAYMENT_CODES = new Set(Object.keys(ALL_LABELS));
