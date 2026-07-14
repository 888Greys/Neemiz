/**
 * International payment methods by currency / market.
 * Inspired by Desktop Payment methods.txt (reference only — not exhaustive of product intent).
 * Crypto is always offered on top in the wallet layer.
 */
import { METHOD_REGISTRY, type MethodCode } from "@/lib/payments/method-registry";
import { WORLD_COUNTRIES } from "@/lib/payments/world-countries";

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

/** Curated major markets — richer, hand-tuned rail sets that take precedence. */
const CURATED_MARKETS: Market[] = [
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

/** Full world catalogue (generated from the country → methods reference list).
 *  Region is a representative country; methods are the local rails for that
 *  currency. Merged UNDER the curated markets above (curated wins for shared
 *  currencies, keeping their richer, hand-tuned rail order). */
type CatalogMarket = { currency: string; region: string; methods: MethodCode[] };
const CATALOG_MARKETS: CatalogMarket[] = [
  { currency: "AFN", region: "Afghanistan", methods: C("CASH_PERSON", "BANK", "MOBILE_MONEY", "VISA", "MASTERCARD") },
  { currency: "ALL", region: "Albania", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK", "MOBILE_MONEY") },
  { currency: "AMD", region: "Armenia", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK", "MOBILE_MONEY") },
  { currency: "AOA", region: "Angola", methods: C("CASH_PERSON", "BANK", "VISA", "MASTERCARD", "MOBILE_MONEY") },
  { currency: "ARS", region: "Argentina", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK", "MERCADOPAGO") },
  { currency: "AUD", region: "Australia", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "AMEX", "APPLE_PAY", "GOOGLE_PAY", "PAYPAL", "BANK") },
  { currency: "AZN", region: "Azerbaijan", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "BAM", region: "Bosnia and Herzegovina", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "BBD", region: "Barbados", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "AMEX", "BANK") },
  { currency: "BDT", region: "Bangladesh", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK", "BKASH", "NAGAD", "ROCKET") },
  { currency: "BGN", region: "Bulgaria", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK", "APPLE_PAY", "GOOGLE_PAY") },
  { currency: "BHD", region: "Bahrain", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "APPLE_PAY", "BENEFITPAY", "BANK") },
  { currency: "BIF", region: "Burundi", methods: C("CASH_PERSON", "BANK", "MOBILE_MONEY") },
  { currency: "BND", region: "Brunei", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "BOB", region: "Bolivia", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "BRL", region: "Brazil", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "AMEX", "PIX", "BANK", "PAYPAL") },
  { currency: "BSD", region: "Bahamas", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "AMEX", "BANK") },
  { currency: "BTN", region: "Bhutan", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK", "MOBILE_MONEY") },
  { currency: "BWP", region: "Botswana", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK", "ORANGE_MONEY") },
  { currency: "BYN", region: "Belarus", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "MIR", "BANK") },
  { currency: "BZD", region: "Belize", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "CAD", region: "Canada", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "AMEX", "INTERAC", "APPLE_PAY", "GOOGLE_PAY", "PAYPAL") },
  { currency: "CDF", region: "Congo (Democratic Republic of the Congo)", methods: C("CASH_PERSON", "MOBILE_MONEY", "BANK", "VISA") },
  { currency: "CHF", region: "Liechtenstein", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "APPLE_PAY", "GOOGLE_PAY", "BANK") },
  { currency: "CLP", region: "Chile", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK", "MACH", "APPLE_PAY") },
  { currency: "CNY", region: "China", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "UNIONPAY", "ALIPAY", "WECHAT") },
  { currency: "COP", region: "Colombia", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "PSE", "NEQUI", "DAVIPLATA", "BANK") },
  { currency: "CRC", region: "Costa Rica", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "SINPE_MOVIL", "BANK") },
  { currency: "CUP", region: "Cuba", methods: C("CASH_PERSON", "BANK", "VISA", "MASTERCARD") },
  { currency: "CVE", region: "Cabo Verde (Cape Verde)", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "CZK", region: "Czech Republic", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "APPLE_PAY", "GOOGLE_PAY", "BANK") },
  { currency: "DJF", region: "Djibouti", methods: C("CASH_PERSON", "BANK", "MOBILE_MONEY") },
  { currency: "DKK", region: "Denmark", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "MOBILEPAY", "APPLE_PAY", "BANK") },
  { currency: "DOP", region: "Dominican Republic", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "AMEX", "BANK") },
  { currency: "DZD", region: "Algeria", methods: C("CASH_PERSON", "BANK", "VISA", "MASTERCARD") },
  { currency: "EGP", region: "Egypt", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "MEEZA", "FAWRY", "BANK") },
  { currency: "ERN", region: "Eritrea", methods: C("CASH_PERSON", "BANK") },
  { currency: "ETB", region: "Ethiopia", methods: C("CASH_PERSON", "BANK", "TELEBIRR", "VISA", "MASTERCARD") },
  { currency: "EUR", region: "Andorra", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "APPLE_PAY", "GOOGLE_PAY", "BANK", "SEPA", "BANCONTACT", "MAESTRO", "MOBILEPAY", "PAYPAL", "GIROCARD", "AMEX", "IDEAL", "BIZUM") },
  { currency: "FJD", region: "Fiji", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "GEL", region: "Georgia", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "APPLE_PAY", "GOOGLE_PAY", "BANK") },
  { currency: "GHS", region: "Ghana", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "MTN_MOMO", "AIRTELTIGO", "TELECEL", "BANK") },
  { currency: "GMD", region: "Gambia", methods: C("CASH_PERSON", "MOBILE_MONEY", "BANK") },
  { currency: "GNF", region: "Guinea", methods: C("CASH_PERSON", "MOBILE_MONEY", "BANK") },
  { currency: "GTQ", region: "Guatemala", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "GYD", region: "Guyana", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "HNL", region: "Honduras", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "HTG", region: "Haiti", methods: C("CASH_PERSON", "BANK", "MOBILE_MONEY") },
  { currency: "HUF", region: "Hungary", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "APPLE_PAY", "GOOGLE_PAY", "BANK") },
  { currency: "IDR", region: "Indonesia", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "QRIS", "GOPAY", "OVO", "DANA", "BANK") },
  { currency: "ILS", region: "Israel", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "AMEX", "APPLE_PAY", "GOOGLE_PAY", "BIT", "BANK") },
  { currency: "INR", region: "India", methods: C("CASH_PERSON", "UPI", "VISA", "MASTERCARD", "RUPAY", "NET_BANKING", "PAYTM", "PHONEPE", "GOOGLE_PAY", "BHIM") },
  { currency: "IQD", region: "Iraq", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "IRR", region: "Iran", methods: C("CASH_PERSON", "LOCAL_CARDS", "BANK") },
  { currency: "ISK", region: "Iceland", methods: C("VISA", "MASTERCARD", "APPLE_PAY", "GOOGLE_PAY", "BANK", "CASH_PERSON") },
  { currency: "JMD", region: "Jamaica", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "JOD", region: "Jordan", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "CLIQ", "BANK") },
  { currency: "JPY", region: "Japan", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "JCB", "SUICA", "PASMO", "PAYPAY", "LINE_PAY", "BANK") },
  { currency: "KES", region: "Kenya", methods: C("CASH_PERSON", "MPESA", "AIRTEL", "VISA", "MASTERCARD", "BANK") },
  { currency: "KGS", region: "Kyrgyzstan", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "ELCART", "BANK") },
  { currency: "KHR", region: "Cambodia", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "ABA_PAY", "KHQR", "BANK") },
  { currency: "KMF", region: "Comoros", methods: C("CASH_PERSON", "BANK") },
  { currency: "KWD", region: "Kuwait", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "KNET", "APPLE_PAY", "BANK") },
  { currency: "KZT", region: "Kazakhstan", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "KASPI", "BANK") },
  { currency: "LAK", region: "Laos", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BCEL_ONE", "BANK") },
  { currency: "LBP", region: "Lebanon", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "LKR", region: "Sri Lanka", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "LANKAPAY", "GENIE", "BANK") },
  { currency: "LRD", region: "Liberia", methods: C("CASH_PERSON", "MOBILE_MONEY", "VISA", "BANK") },
  { currency: "LSL", region: "Lesotho", methods: C("CASH_PERSON", "MOBILE_MONEY", "VISA", "MASTERCARD", "BANK") },
  { currency: "LYD", region: "Libya", methods: C("CASH_PERSON", "LOCAL_CARDS", "BANK") },
  { currency: "MAD", region: "Morocco", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "MOBILE_MONEY", "BANK") },
  { currency: "MDL", region: "Moldova", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "APPLE_PAY", "GOOGLE_PAY", "BANK") },
  { currency: "MGA", region: "Madagascar", methods: C("CASH_PERSON", "MOBILE_MONEY", "BANK") },
  { currency: "MMK", region: "Myanmar", methods: C("CASH_PERSON", "KBZPAY", "WAVE_MONEY", "CB_PAY", "BANK") },
  { currency: "MNT", region: "Mongolia", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "QPAY", "BANK") },
  { currency: "MRU", region: "Mauritania", methods: C("CASH_PERSON", "BANK", "MOBILE_MONEY") },
  { currency: "MUR", region: "Mauritius", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "JUICE", "BANK") },
  { currency: "MVR", region: "Maldives", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "AMEX", "BANK") },
  { currency: "MWK", region: "Malawi", methods: C("CASH_PERSON", "MOBILE_MONEY", "VISA", "MASTERCARD", "BANK") },
  { currency: "MXN", region: "Mexico", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "AMEX", "SPEI", "CODI", "PAYPAL", "BANK") },
  { currency: "MYR", region: "Malaysia", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "DUITNOW", "TNG", "GRABPAY", "FPX", "BANK") },
  { currency: "MZN", region: "Mozambique", methods: C("CASH_PERSON", "MPESA", "EMOLA", "MKESH", "VISA", "MASTERCARD", "BANK") },
  { currency: "NAD", region: "Namibia", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK", "MOBILE_MONEY") },
  { currency: "NGN", region: "Nigeria", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "VERVE", "NIBSS") },
  { currency: "NIO", region: "Nicaragua", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "NPR", region: "Nepal", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "ESEWA", "KHALTI", "IME_PAY", "BANK") },
  { currency: "NZD", region: "New Zealand", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "POLI", "APPLE_PAY", "GOOGLE_PAY", "BANK") },
  { currency: "RSD", region: "Serbia", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "DINACARD", "APPLE_PAY", "BANK") },
  { currency: "RWF", region: "Rwanda", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "MTN_MOMO", "AIRTEL", "BANK") },
  { currency: "SAR", region: "Saudi Arabia", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "MADA", "APPLE_PAY", "BANK") },
  { currency: "SBD", region: "Solomon Islands", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "SCR", region: "Seychelles", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "SGD", region: "Singapore", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "AMEX", "PAYNOW", "NETS", "GRABPAY", "APPLE_PAY", "GOOGLE_PAY") },
  { currency: "SLE", region: "Sierra Leone", methods: C("CASH_PERSON", "MOBILE_MONEY", "BANK") },
  { currency: "SOS", region: "Somalia", methods: C("CASH_PERSON", "EVC_PLUS", "ZAAD", "SAHAL", "MOBILE_MONEY") },
  { currency: "SSP", region: "South Sudan", methods: C("CASH_PERSON", "MOBILE_MONEY", "BANK") },
  { currency: "STN", region: "São Tomé and Príncipe", methods: C("CASH_PERSON", "BANK") },
  { currency: "SZL", region: "Eswatini", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "MOBILE_MONEY", "BANK") },
  { currency: "USD", region: "Ecuador", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK", "MOBILE_MONEY", "BTC", "AMEX", "DISCOVER", "APPLE_PAY", "GOOGLE_PAY", "PAYPAL", "ACH") },
  { currency: "UYU", region: "Uruguay", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "UZS", region: "Uzbekistan", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "HUMO", "UZCARD", "BANK") },
  { currency: "VES", region: "Venezuela", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "PAGO_MOVIL", "BANK") },
  { currency: "VND", region: "Vietnam", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "MOMO_VN", "ZALOPAY", "VIETQR", "BANK") },
  { currency: "VUV", region: "Vanuatu", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "WST", region: "Samoa", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "BANK") },
  { currency: "XAF", region: "Cameroon", methods: C("CASH_PERSON", "MOBILE_MONEY", "BANK", "VISA", "MASTERCARD") },
  { currency: "XCD", region: "Antigua and Barbuda", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "AMEX", "BANK") },
  { currency: "XOF", region: "Benin", methods: C("CASH_PERSON", "BANK", "MOBILE_MONEY", "VISA", "MASTERCARD", "ORANGE_MONEY", "WAVE", "FREE_MONEY") },
  { currency: "YER", region: "Yemen", methods: C("CASH_PERSON", "BANK") },
  { currency: "ZAR", region: "South Africa", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "INSTANT_EFT", "SNAPSCAN", "ZAPPER", "APPLE_PAY", "GOOGLE_PAY") },
  { currency: "ZMW", region: "Zambia", methods: C("CASH_PERSON", "AIRTEL", "MTN_MOMO", "VISA", "MASTERCARD", "BANK") },
  { currency: "ZWG", region: "Zimbabwe", methods: C("CASH_PERSON", "VISA", "MASTERCARD", "ECOCASH", "ZIPIT", "BANK") },
];

/** Merge curated + catalog: curated markets win; catalog fills coverage and adds
 *  any extra local rails a curated market doesn't already list. */
const CURRENCY_NAME: Record<string, string> = Object.fromEntries(
  WORLD_COUNTRIES.map((c) => [c.currency, c.currencyName]),
);
function buildMarkets(): Market[] {
  const byCurrency = new Map<string, Market>();
  for (const m of CURATED_MARKETS) byCurrency.set(m.currency, { ...m, methods: [...m.methods] });
  for (const cat of CATALOG_MARKETS) {
    const existing = byCurrency.get(cat.currency);
    if (existing) {
      for (const code of cat.methods) if (!existing.methods.includes(code)) existing.methods.push(code);
    } else {
      byCurrency.set(cat.currency, {
        currency: cat.currency,
        label: CURRENCY_NAME[cat.currency] ?? cat.currency,
        region: cat.region,
        methods: [...cat.methods],
      });
    }
  }
  return [...byCurrency.values()];
}

export const MARKETS: Market[] = buildMarkets();

export const MARKET_BY_CURRENCY: Record<string, Market> = Object.fromEntries(
  MARKETS.map((m) => [m.currency, m]),
);

/** Always-available crypto rails for custodial wallet (international). */
export const GLOBAL_CRYPTO_METHODS: MethodCode[] = ["USDT", "BTC", "USDC", "CRYPTO", "ETH"];

export function marketForCurrency(currency: string | null | undefined): Market {
  if (currency && MARKET_BY_CURRENCY[currency]) return MARKET_BY_CURRENCY[currency];
  const code = currency || "USD";
  // Unknown ISO currencies still get a sensible international card/bank set + crypto.
  return {
    currency: code,
    label: code,
    region: "International",
    methods: C("VISA", "MASTERCARD", "BANK", "APPLE_PAY", "GOOGLE_PAY", "PAYPAL", "WISE"),
  };
}

export function methodsForCurrency(currency: string | null | undefined): MethodCode[] {
  return marketForCurrency(currency).methods;
}

/** Named brand codes that should have logo coverage (excludes generic MOBILE_MONEY). */
export function namedBrandCodes(): string[] {
  return Object.keys(METHOD_REGISTRY).filter((c) => c !== "MOBILE_MONEY" && c !== "CRYPTO");
}
