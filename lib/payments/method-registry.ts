/**
 * Canonical payment-method codes used across wallet + P2P.
 * Desktop `Payment methods.txt` is reference only — this registry is the product catalogue.
 */
export type PaymentCategory =
  | "Cards"
  | "Mobile Money"
  | "Bank"
  | "Online Wallets"
  | "Wallets & Neobanks"
  | "Crypto"
  | "Gift Cards"
  | "Cash"
  | "Other";

export type MethodCode = string;

export type MethodDef = {
  code: MethodCode;
  label: string;
  category: PaymentCategory;
  /** Custodial wallet: live processor exists today. */
  walletLive?: boolean;
  /** Maps to existing DepositSelection kinds when live. */
  walletRail?: "mpesa" | "pesapal" | "crypto";
  cryptoGroup?: "USDT" | "BTC" | "ETH" | "OTHER";
};

export const METHOD_REGISTRY: Record<string, MethodDef> = {
  // Cards
  VISA:        { code: "VISA",        label: "Visa",              category: "Cards", walletLive: true,  walletRail: "pesapal" },
  MASTERCARD:  { code: "MASTERCARD",  label: "Mastercard",        category: "Cards", walletLive: true,  walletRail: "pesapal" },
  AMEX:        { code: "AMEX",        label: "American Express",  category: "Cards" },
  UNIONPAY:    { code: "UNIONPAY",    label: "UnionPay",          category: "Cards" },
  RUPAY:       { code: "RUPAY",       label: "RuPay",             category: "Cards" },
  JCB:         { code: "JCB",         label: "JCB",               category: "Cards" },
  MAESTRO:     { code: "MAESTRO",     label: "Maestro",           category: "Cards" },
  MEEZA:       { code: "MEEZA",       label: "Meeza",             category: "Cards" },

  // Mobile money / local rails
  MPESA:       { code: "MPESA",       label: "M-Pesa",            category: "Mobile Money", walletLive: true, walletRail: "mpesa" },
  AIRTEL:      { code: "AIRTEL",      label: "Airtel Money",      category: "Mobile Money" },
  MTN_MOMO:    { code: "MTN_MOMO",    label: "MTN MoMo",          category: "Mobile Money" },
  VODAFONE_CASH: { code: "VODAFONE_CASH", label: "Vodafone Cash", category: "Mobile Money" },
  TIGO_PESA:   { code: "TIGO_PESA",   label: "Tigo Pesa",         category: "Mobile Money" },
  ORANGE_MONEY:{ code: "ORANGE_MONEY",label: "Orange Money",      category: "Mobile Money" },
  MOOV_MONEY:  { code: "MOOV_MONEY",  label: "Moov Money",        category: "Mobile Money" },
  WAVE:        { code: "WAVE",        label: "Wave",              category: "Mobile Money" },
  ECOCASH:     { code: "ECOCASH",     label: "EcoCash",           category: "Mobile Money" },
  MPAMBA:      { code: "MPAMBA",      label: "Airtel Mpamba",     category: "Mobile Money" },
  TELEBIRR:    { code: "TELEBIRR",    label: "Telebirr",          category: "Mobile Money" },
  TELECEL:     { code: "TELECEL",     label: "Telecel Cash",      category: "Mobile Money" },
  GCASH:       { code: "GCASH",       label: "GCash",             category: "Mobile Money" },
  MAYA:        { code: "MAYA",        label: "Maya",              category: "Mobile Money" },
  JAZZCASH:    { code: "JAZZCASH",    label: "JazzCash",          category: "Mobile Money" },
  EASYPAISA:   { code: "EASYPAISA",   label: "Easypaisa",         category: "Mobile Money" },
  BKASH:       { code: "BKASH",       label: "bKash",             category: "Mobile Money" },
  NAGAD:       { code: "NAGAD",       label: "Nagad",             category: "Mobile Money" },
  ROCKET:      { code: "ROCKET",      label: "Rocket",            category: "Mobile Money" },
  MOBILE_MONEY:{ code: "MOBILE_MONEY",label: "Mobile Money",      category: "Mobile Money" },
  MOBILEPAY:   { code: "MOBILEPAY",   label: "MobilePay",         category: "Mobile Money" },
  FAWRY:       { code: "FAWRY",       label: "Fawry",             category: "Mobile Money" },
  BENEFITPAY:  { code: "BENEFITPAY",  label: "BenefitPay",        category: "Mobile Money" },
  KNET:        { code: "KNET",        label: "KNET",              category: "Bank" },
  INTERAC:     { code: "INTERAC",     label: "Interac",           category: "Bank" },
  BANCONTACT:  { code: "BANCONTACT",  label: "Bancontact",        category: "Bank" },
  GIROCARD:    { code: "GIROCARD",    label: "Girocard",          category: "Bank" },
  IDEAL:       { code: "IDEAL",       label: "iDEAL",             category: "Bank" },

  // Bank / instant bank
  BANK:        { code: "BANK",        label: "Bank Transfer",     category: "Bank" },
  SEPA:        { code: "SEPA",        label: "SEPA",              category: "Bank" },
  SWIFT:       { code: "SWIFT",       label: "SWIFT / Wire",      category: "Bank" },
  UPI:         { code: "UPI",         label: "UPI",               category: "Bank" },
  IMPS:        { code: "IMPS",        label: "IMPS",              category: "Bank" },
  PIX:         { code: "PIX",         label: "Pix",               category: "Bank" },
  SPEI:        { code: "SPEI",        label: "SPEI",              category: "Bank" },
  FPX:         { code: "FPX",         label: "FPX",               category: "Bank" },
  DUITNOW:     { code: "DUITNOW",     label: "DuitNow",           category: "Bank" },
  QRIS:        { code: "QRIS",        label: "QRIS",              category: "Bank" },
  PSE:         { code: "PSE",         label: "PSE",               category: "Bank" },
  FNB:         { code: "FNB",         label: "FNB",               category: "Bank" },
  CAPITEC:     { code: "CAPITEC",     label: "Capitec",           category: "Bank" },
  CLIQ:        { code: "CLIQ",        label: "CliQ",              category: "Bank" },

  // Online wallets
  PAYPAL:      { code: "PAYPAL",      label: "PayPal",            category: "Online Wallets" },
  WISE:        { code: "WISE",        label: "Wise",              category: "Online Wallets" },
  REVOLUT:     { code: "REVOLUT",     label: "Revolut",           category: "Online Wallets" },
  SKRILL:      { code: "SKRILL",      label: "Skrill",            category: "Online Wallets" },
  NETELLER:    { code: "NETELLER",    label: "Neteller",          category: "Online Wallets" },
  PAYONEER:    { code: "PAYONEER",    label: "Payoneer",          category: "Online Wallets" },
  APPLE_PAY:   { code: "APPLE_PAY",   label: "Apple Pay",         category: "Online Wallets" },
  GOOGLE_PAY:  { code: "GOOGLE_PAY",  label: "Google Pay",        category: "Online Wallets" },
  ALIPAY:      { code: "ALIPAY",      label: "Alipay",            category: "Online Wallets" },
  WECHAT:      { code: "WECHAT",      label: "WeChat Pay",        category: "Online Wallets" },
  PAYTM:       { code: "PAYTM",       label: "Paytm",             category: "Online Wallets" },
  PHONEPE:     { code: "PHONEPE",     label: "PhonePe",           category: "Online Wallets" },
  GOPAY:       { code: "GOPAY",       label: "GoPay",             category: "Online Wallets" },
  OVO:         { code: "OVO",         label: "OVO",               category: "Online Wallets" },
  DANA:        { code: "DANA",        label: "DANA",              category: "Online Wallets" },
  GRABPAY:     { code: "GRABPAY",     label: "GrabPay",           category: "Online Wallets" },
  TNG:         { code: "TNG",         label: "Touch 'n Go",       category: "Online Wallets" },
  MERCADOPAGO: { code: "MERCADOPAGO", label: "Mercado Pago",      category: "Online Wallets" },
  ZELLE:       { code: "ZELLE",       label: "Zelle",             category: "Online Wallets" },
  CASHAPP:     { code: "CASHAPP",     label: "Cash App",          category: "Online Wallets" },
  VENMO:       { code: "VENMO",       label: "Venmo",             category: "Online Wallets" },
  PAPARA:      { code: "PAPARA",      label: "Papara",            category: "Online Wallets" },
  TRUEMONEY:   { code: "TRUEMONEY",   label: "TrueMoney",         category: "Online Wallets" },
  PAYPAY:      { code: "PAYPAY",      label: "PayPay",            category: "Online Wallets" },
  LINE_PAY:    { code: "LINE_PAY",    label: "LINE Pay",          category: "Online Wallets" },
  KASPI:       { code: "KASPI",       label: "Kaspi Pay",         category: "Online Wallets" },
  NEQUI:       { code: "NEQUI",       label: "Nequi",             category: "Online Wallets" },
  DAVIPLATA:   { code: "DAVIPLATA",   label: "Daviplata",         category: "Online Wallets" },

  // Neobanks
  OPAY:        { code: "OPAY",        label: "Opay",              category: "Wallets & Neobanks" },
  PALMPAY:     { code: "PALMPAY",     label: "PalmPay",           category: "Wallets & Neobanks" },
  KUDA:        { code: "KUDA",        label: "Kuda Bank",         category: "Wallets & Neobanks" },
  MONIEPOINT:  { code: "MONIEPOINT",  label: "Moniepoint",        category: "Wallets & Neobanks" },

  // Crypto (custodial wallet)
  USDT:        { code: "USDT",        label: "USDT",              category: "Crypto", walletLive: true, walletRail: "crypto", cryptoGroup: "USDT" },
  BTC:         { code: "BTC",         label: "Bitcoin",           category: "Crypto", walletLive: true, walletRail: "crypto", cryptoGroup: "BTC" },
  ETH:         { code: "ETH",         label: "Ethereum",          category: "Crypto", walletRail: "crypto", cryptoGroup: "ETH" },
  USDC:        { code: "USDC",        label: "USDC",              category: "Crypto", walletLive: true, walletRail: "crypto", cryptoGroup: "OTHER" },
  CRYPTO:      { code: "CRYPTO",      label: "Crypto",            category: "Crypto", walletLive: true, walletRail: "crypto", cryptoGroup: "OTHER" },

  // ── Extended global catalogue (country-specific rails from the world list) ──
  DINACARD:    { code: "DINACARD", label: "DinaCard", category: "Cards" },
  DISCOVER:    { code: "DISCOVER", label: "Discover", category: "Cards" },
  ELCART:      { code: "ELCART", label: "Elcart", category: "Cards" },
  HUMO:        { code: "HUMO", label: "Humo", category: "Cards" },
  LOCAL_CARDS: { code: "LOCAL_CARDS", label: "Local Bank Card", category: "Cards" },
  MADA:        { code: "MADA", label: "mada", category: "Cards" },
  MIR:         { code: "MIR", label: "MIR", category: "Cards" },
  UZCARD:      { code: "UZCARD", label: "Uzcard", category: "Cards" },
  VERVE:       { code: "VERVE", label: "Verve", category: "Cards" },
  AIRTELTIGO:  { code: "AIRTELTIGO", label: "AirtelTigo Money", category: "Mobile Money" },
  CB_PAY:      { code: "CB_PAY", label: "CB Pay", category: "Mobile Money" },
  EMOLA:       { code: "EMOLA", label: "e-Mola", category: "Mobile Money" },
  ESEWA:       { code: "ESEWA", label: "eSewa", category: "Mobile Money" },
  EVC_PLUS:    { code: "EVC_PLUS", label: "EVC Plus", category: "Mobile Money" },
  FREE_MONEY:  { code: "FREE_MONEY", label: "Free Money", category: "Mobile Money" },
  IME_PAY:     { code: "IME_PAY", label: "IME Pay", category: "Mobile Money" },
  JUICE:       { code: "JUICE", label: "Juice", category: "Mobile Money" },
  KBZPAY:      { code: "KBZPAY", label: "KBZPay", category: "Mobile Money" },
  KHALTI:      { code: "KHALTI", label: "Khalti", category: "Mobile Money" },
  MKESH:       { code: "MKESH", label: "mKesh", category: "Mobile Money" },
  SAHAL:       { code: "SAHAL", label: "Sahal", category: "Mobile Money" },
  WAVE_MONEY:  { code: "WAVE_MONEY", label: "Wave Money", category: "Mobile Money" },
  ZAAD:        { code: "ZAAD", label: "Zaad", category: "Mobile Money" },
  ABA_PAY:     { code: "ABA_PAY", label: "ABA Pay", category: "Bank" },
  ACH:         { code: "ACH", label: "ACH", category: "Bank" },
  BCEL_ONE:    { code: "BCEL_ONE", label: "BCEL One", category: "Bank" },
  BIZUM:       { code: "BIZUM", label: "Bizum", category: "Bank" },
  CODI:        { code: "CODI", label: "CoDi", category: "Bank" },
  INSTANT_EFT: { code: "INSTANT_EFT", label: "Instant EFT", category: "Bank" },
  KHQR:        { code: "KHQR", label: "KHQR", category: "Bank" },
  LANKAPAY:    { code: "LANKAPAY", label: "LankaPay", category: "Bank" },
  NET_BANKING: { code: "NET_BANKING", label: "Net Banking", category: "Bank" },
  NETS:        { code: "NETS", label: "NETS", category: "Bank" },
  NIBSS:       { code: "NIBSS", label: "NIBSS", category: "Bank" },
  PAGO_MOVIL:  { code: "PAGO_MOVIL", label: "Pago Móvil", category: "Bank" },
  PAYNOW:      { code: "PAYNOW", label: "PayNow", category: "Bank" },
  POLI:        { code: "POLI", label: "POLi", category: "Bank" },
  QPAY:        { code: "QPAY", label: "QPay", category: "Bank" },
  SINPE_MOVIL: { code: "SINPE_MOVIL", label: "SINPE Móvil", category: "Bank" },
  VIETQR:      { code: "VIETQR", label: "VietQR", category: "Bank" },
  ZIPIT:       { code: "ZIPIT", label: "ZIPIT", category: "Bank" },
  BHIM:        { code: "BHIM", label: "BHIM", category: "Online Wallets" },
  BIT:         { code: "BIT", label: "Bit", category: "Online Wallets" },
  GENIE:       { code: "GENIE", label: "Genie", category: "Online Wallets" },
  MACH:        { code: "MACH", label: "MACH", category: "Online Wallets" },
  MOMO_VN:     { code: "MOMO_VN", label: "MoMo", category: "Online Wallets" },
  PASMO:       { code: "PASMO", label: "PASMO", category: "Online Wallets" },
  SNAPSCAN:    { code: "SNAPSCAN", label: "SnapScan", category: "Online Wallets" },
  SUICA:       { code: "SUICA", label: "Suica", category: "Online Wallets" },
  ZALOPAY:     { code: "ZALOPAY", label: "ZaloPay", category: "Online Wallets" },
  ZAPPER:      { code: "ZAPPER", label: "Zapper", category: "Online Wallets" },

  // Gift cards (cross-border, universal)
  GIFT_AMAZON:      { code: "GIFT_AMAZON",      label: "Amazon Gift Card",       category: "Gift Cards" },
  GIFT_APPLE:       { code: "GIFT_APPLE",       label: "Apple Gift Card",        category: "Gift Cards" },
  GIFT_GOOGLE_PLAY: { code: "GIFT_GOOGLE_PLAY", label: "Google Play Gift Card",  category: "Gift Cards" },
  GIFT_STEAM:       { code: "GIFT_STEAM",       label: "Steam Gift Card",        category: "Gift Cards" },
  GIFT_PLAYSTATION: { code: "GIFT_PLAYSTATION", label: "PlayStation Store Card", category: "Gift Cards" },
  GIFT_XBOX:        { code: "GIFT_XBOX",        label: "Xbox Gift Card",         category: "Gift Cards" },

  // Cash
  CASH_DEPOSIT:{ code: "CASH_DEPOSIT",label: "Cash Deposit",      category: "Cash" },
  CASH_PERSON: { code: "CASH_PERSON", label: "Cash in Person",    category: "Cash" },
};

export function methodLabel(code: string): string {
  return METHOD_REGISTRY[code]?.label ?? code;
}

export function methodCategory(code: string): PaymentCategory {
  return METHOD_REGISTRY[code]?.category ?? "Other";
}

export const ALL_METHOD_CODES = Object.keys(METHOD_REGISTRY);
