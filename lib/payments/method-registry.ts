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
  CRYPTO:      { code: "CRYPTO",      label: "Other Crypto",      category: "Crypto", walletLive: true, walletRail: "crypto", cryptoGroup: "OTHER" },

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
