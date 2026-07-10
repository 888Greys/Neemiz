/**
 * International payment methods by currency / market.
 * Inspired by Desktop Payment methods.txt (reference only — not exhaustive of product intent).
 * Crypto is always offered on top in the wallet layer.
 */
import { METHOD_REGISTRY, type MethodCode } from "@/lib/payments/method-registry";

export type Market = {
  /** ISO 4217 */
  currency: string;
  /** Display name for the market picker */
  label: string;
  /** Primary country hint for UI copy */
  region: string;
  /** Local / regional method codes (cards, MoMo, bank, wallets) */
  methods: MethodCode[];
};

const C = (...codes: MethodCode[]): MethodCode[] =>
  codes.filter((c) => METHOD_REGISTRY[c]);

/** Core international markets shown in wallet + used to seed P2P fiat maps. */
export const MARKETS: Market[] = [
  {
    currency: "USD",
    label: "US Dollar",
    region: "United States / Global",
    methods: C("VISA", "MASTERCARD", "AMEX", "APPLE_PAY", "GOOGLE_PAY", "PAYPAL", "ZELLE", "CASHAPP", "VENMO", "WISE", "BANK", "SWIFT"),
  },
  {
    currency: "EUR",
    label: "Euro",
    region: "Eurozone",
    methods: C("VISA", "MASTERCARD", "APPLE_PAY", "GOOGLE_PAY", "PAYPAL", "SEPA", "BANCONTACT", "IDEAL", "GIROCARD", "REVOLUT", "WISE", "BANK"),
  },
  {
    currency: "GBP",
    label: "British Pound",
    region: "United Kingdom",
    methods: C("VISA", "MASTERCARD", "APPLE_PAY", "GOOGLE_PAY", "PAYPAL", "REVOLUT", "WISE", "BANK"),
  },
  {
    currency: "KES",
    label: "Kenyan Shilling",
    region: "Kenya",
    methods: C("MPESA", "AIRTEL", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "NGN",
    label: "Nigerian Naira",
    region: "Nigeria",
    methods: C("OPAY", "PALMPAY", "KUDA", "MONIEPOINT", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "GHS",
    label: "Ghanaian Cedi",
    region: "Ghana",
    methods: C("MTN_MOMO", "VODAFONE_CASH", "TELECEL", "AIRTEL", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "ZAR",
    label: "South African Rand",
    region: "South Africa",
    methods: C("FNB", "CAPITEC", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "TZS",
    label: "Tanzanian Shilling",
    region: "Tanzania",
    methods: C("MPESA", "AIRTEL", "TIGO_PESA", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "UGX",
    label: "Ugandan Shilling",
    region: "Uganda",
    methods: C("MTN_MOMO", "AIRTEL", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "RWF",
    label: "Rwandan Franc",
    region: "Rwanda",
    methods: C("MTN_MOMO", "AIRTEL", "MOBILE_MONEY", "BANK"),
  },
  {
    currency: "ETB",
    label: "Ethiopian Birr",
    region: "Ethiopia",
    methods: C("TELEBIRR", "BANK", "VISA", "MASTERCARD"),
  },
  {
    currency: "EGP",
    label: "Egyptian Pound",
    region: "Egypt",
    methods: C("VISA", "MASTERCARD", "MEEZA", "FAWRY", "BANK"),
  },
  {
    currency: "XOF",
    label: "West African CFA",
    region: "West Africa",
    methods: C("ORANGE_MONEY", "MTN_MOMO", "MOOV_MONEY", "WAVE", "MOBILE_MONEY", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "XAF",
    label: "Central African CFA",
    region: "Central Africa",
    methods: C("MTN_MOMO", "ORANGE_MONEY", "MOBILE_MONEY", "BANK"),
  },
  {
    currency: "BRL",
    label: "Brazilian Real",
    region: "Brazil",
    methods: C("PIX", "VISA", "MASTERCARD", "AMEX", "PAYPAL", "BANK"),
  },
  {
    currency: "MXN",
    label: "Mexican Peso",
    region: "Mexico",
    methods: C("SPEI", "VISA", "MASTERCARD", "AMEX", "MERCADOPAGO", "BANK"),
  },
  {
    currency: "ARS",
    label: "Argentine Peso",
    region: "Argentina",
    methods: C("MERCADOPAGO", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "COP",
    label: "Colombian Peso",
    region: "Colombia",
    methods: C("PSE", "NEQUI", "DAVIPLATA", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "INR",
    label: "Indian Rupee",
    region: "India",
    methods: C("UPI", "IMPS", "RUPAY", "VISA", "MASTERCARD", "PAYTM", "PHONEPE", "GOOGLE_PAY", "BANK"),
  },
  {
    currency: "BDT",
    label: "Bangladeshi Taka",
    region: "Bangladesh",
    methods: C("BKASH", "NAGAD", "ROCKET", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "PKR",
    label: "Pakistani Rupee",
    region: "Pakistan",
    methods: C("JAZZCASH", "EASYPAISA", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "PHP",
    label: "Philippine Peso",
    region: "Philippines",
    methods: C("GCASH", "MAYA", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "IDR",
    label: "Indonesian Rupiah",
    region: "Indonesia",
    methods: C("QRIS", "GOPAY", "OVO", "DANA", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "MYR",
    label: "Malaysian Ringgit",
    region: "Malaysia",
    methods: C("DUITNOW", "FPX", "TNG", "GRABPAY", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "THB",
    label: "Thai Baht",
    region: "Thailand",
    methods: C("TRUEMONEY", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "VND",
    label: "Vietnamese Dong",
    region: "Vietnam",
    methods: C("VISA", "MASTERCARD", "BANK", "MOBILE_MONEY"),
  },
  {
    currency: "CNY",
    label: "Chinese Yuan",
    region: "China",
    methods: C("ALIPAY", "WECHAT", "UNIONPAY", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "JPY",
    label: "Japanese Yen",
    region: "Japan",
    methods: C("VISA", "MASTERCARD", "JCB", "APPLE_PAY", "GOOGLE_PAY", "PAYPAY", "LINE_PAY", "BANK"),
  },
  {
    currency: "KRW",
    label: "South Korean Won",
    region: "South Korea",
    methods: C("VISA", "MASTERCARD", "BANK", "APPLE_PAY", "GOOGLE_PAY"),
  },
  {
    currency: "AUD",
    label: "Australian Dollar",
    region: "Australia",
    methods: C("VISA", "MASTERCARD", "AMEX", "APPLE_PAY", "GOOGLE_PAY", "PAYPAL", "BANK"),
  },
  {
    currency: "CAD",
    label: "Canadian Dollar",
    region: "Canada",
    methods: C("VISA", "MASTERCARD", "AMEX", "INTERAC", "APPLE_PAY", "GOOGLE_PAY", "PAYPAL", "BANK"),
  },
  {
    currency: "AED",
    label: "UAE Dirham",
    region: "United Arab Emirates",
    methods: C("VISA", "MASTERCARD", "APPLE_PAY", "BANK"),
  },
  {
    currency: "SAR",
    label: "Saudi Riyal",
    region: "Saudi Arabia",
    methods: C("VISA", "MASTERCARD", "APPLE_PAY", "BANK"),
  },
  {
    currency: "TRY",
    label: "Turkish Lira",
    region: "Türkiye",
    methods: C("VISA", "MASTERCARD", "PAPARA", "BANK"),
  },
  {
    currency: "KZT",
    label: "Kazakhstani Tenge",
    region: "Kazakhstan",
    methods: C("KASPI", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "BHD",
    label: "Bahraini Dinar",
    region: "Bahrain",
    methods: C("VISA", "MASTERCARD", "APPLE_PAY", "BENEFITPAY", "BANK"),
  },
  {
    currency: "KWD",
    label: "Kuwaiti Dinar",
    region: "Kuwait",
    methods: C("VISA", "MASTERCARD", "KNET", "APPLE_PAY", "BANK"),
  },
  {
    currency: "JOD",
    label: "Jordanian Dinar",
    region: "Jordan",
    methods: C("VISA", "MASTERCARD", "CLIQ", "BANK"),
  },
  {
    currency: "ILS",
    label: "Israeli Shekel",
    region: "Israel",
    methods: C("VISA", "MASTERCARD", "AMEX", "APPLE_PAY", "GOOGLE_PAY", "BANK"),
  },
  {
    currency: "CHF",
    label: "Swiss Franc",
    region: "Switzerland",
    methods: C("VISA", "MASTERCARD", "APPLE_PAY", "GOOGLE_PAY", "BANK"),
  },
  {
    currency: "SEK",
    label: "Swedish Krona",
    region: "Sweden",
    methods: C("VISA", "MASTERCARD", "APPLE_PAY", "GOOGLE_PAY", "BANK"),
  },
  {
    currency: "NOK",
    label: "Norwegian Krone",
    region: "Norway",
    methods: C("VISA", "MASTERCARD", "APPLE_PAY", "GOOGLE_PAY", "BANK"),
  },
  {
    currency: "DKK",
    label: "Danish Krone",
    region: "Denmark",
    methods: C("VISA", "MASTERCARD", "MOBILEPAY", "APPLE_PAY", "BANK"),
  },
  {
    currency: "PLN",
    label: "Polish Złoty",
    region: "Poland",
    methods: C("VISA", "MASTERCARD", "APPLE_PAY", "GOOGLE_PAY", "BANK"),
  },
  {
    currency: "BWP",
    label: "Botswana Pula",
    region: "Botswana",
    methods: C("ORANGE_MONEY", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "MWK",
    label: "Malawian Kwacha",
    region: "Malawi",
    methods: C("MPAMBA", "MOBILE_MONEY", "VISA", "MASTERCARD", "BANK"),
  },
  {
    currency: "MZN",
    label: "Mozambican Metical",
    region: "Mozambique",
    methods: C("MPESA", "MOBILE_MONEY", "VISA", "BANK"),
  },
  {
    currency: "ZMW",
    label: "Zambian Kwacha",
    region: "Zambia",
    methods: C("MTN_MOMO", "AIRTEL", "MOBILE_MONEY", "BANK"),
  },
  {
    currency: "CDF",
    label: "Congolese Franc",
    region: "DR Congo",
    methods: C("MOBILE_MONEY", "ORANGE_MONEY", "AIRTEL", "BANK"),
  },
];

export const MARKET_BY_CURRENCY: Record<string, Market> = Object.fromEntries(
  MARKETS.map((m) => [m.currency, m]),
);

/** Always-available crypto rails for custodial wallet (international). */
export const GLOBAL_CRYPTO_METHODS: MethodCode[] = ["USDT", "BTC", "USDC", "CRYPTO", "ETH"];

export function marketForCurrency(currency: string | null | undefined): Market {
  if (currency && MARKET_BY_CURRENCY[currency]) return MARKET_BY_CURRENCY[currency];
  return MARKET_BY_CURRENCY.USD;
}

export function methodsForCurrency(currency: string | null | undefined): MethodCode[] {
  return marketForCurrency(currency).methods;
}

/** Named brand codes that should have logo coverage (excludes generic MOBILE_MONEY). */
export function namedBrandCodes(): string[] {
  return Object.keys(METHOD_REGISTRY).filter((c) => c !== "MOBILE_MONEY" && c !== "CRYPTO");
}
