// ─── Region-specific P2P payment methods ──────────────────────────────────────
// Maps each supported fiat to the local payment rails people actually use, so
// the browse filter and the merchant ad form feel native per country — like
// Binance P2P. `value` is the code stored on P2PAd.paymentMethods; `label` is
// what users see.

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
  { value: "GCASH",        label: "GCash",             category: "Mobile Money" },
  { value: "MAYA",         label: "Maya (PayMaya)",    category: "Mobile Money" },
  { value: "JAZZCASH",     label: "JazzCash",          category: "Mobile Money" },
  { value: "EASYPAISA",    label: "Easypaisa",         category: "Mobile Money" },
  { value: "BKASH",        label: "bKash",             category: "Mobile Money" },
  { value: "NAGAD",        label: "Nagad",             category: "Mobile Money" },
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
  // Bank rails
  { value: "BANK",         label: "Bank Transfer",     category: "Bank" },
  { value: "SEPA",         label: "SEPA",              category: "Bank" },
  { value: "SWIFT",        label: "SWIFT / Wire",      category: "Bank" },
  { value: "UPI",          label: "UPI",               category: "Bank" },
  { value: "IMPS",         label: "IMPS",              category: "Bank" },
  { value: "PIX",          label: "Pix",               category: "Bank" },
  { value: "FNB",          label: "FNB",               category: "Bank" },
  { value: "CAPITEC",      label: "Capitec",           category: "Bank" },
  { value: "SBERBANK",     label: "Sberbank",          category: "Bank" },
  { value: "TINKOFF",      label: "Tinkoff",           category: "Bank" },
  // Cash
  { value: "CASH_DEPOSIT", label: "Cash Deposit",      category: "Cash" },
  { value: "CASH_PERSON",  label: "Cash in Person",    category: "Cash" },
];

export const PAYMENT_METHODS_BY_FIAT: Record<string, PaymentMethod[]> = {
  KES: [
    { value: "MPESA",         label: "M-Pesa" },
    { value: "AIRTEL",        label: "Airtel Money" },
    { value: "BANK",          label: "Bank Transfer" },
  ],
  NGN: [
    { value: "OPAY",          label: "Opay" },
    { value: "PALMPAY",       label: "PalmPay" },
    { value: "KUDA",          label: "Kuda Bank" },
    { value: "BANK",          label: "Bank Transfer" },
  ],
  GHS: [
    { value: "MTN_MOMO",      label: "MTN MoMo" },
    { value: "VODAFONE_CASH", label: "Vodafone Cash" },
    { value: "BANK",          label: "Bank Transfer" },
  ],
  ZAR: [
    { value: "FNB",           label: "FNB" },
    { value: "CAPITEC",       label: "Capitec" },
    { value: "BANK",          label: "Bank Transfer" },
  ],
  TZS: [
    { value: "MPESA",         label: "M-Pesa" },
    { value: "AIRTEL",        label: "Airtel Money" },
    { value: "TIGO_PESA",     label: "Tigo Pesa" },
    { value: "BANK",          label: "Bank Transfer" },
  ],
  UGX: [
    { value: "MTN_MOMO",      label: "MTN MoMo" },
    { value: "AIRTEL",        label: "Airtel Money" },
    { value: "BANK",          label: "Bank Transfer" },
  ],
  USD: [
    { value: "BANK",          label: "Bank Transfer" },
    { value: "WISE",          label: "Wise" },
    { value: "PAYPAL",        label: "PayPal" },
  ],
  EUR: [
    { value: "SEPA",          label: "SEPA" },
    { value: "REVOLUT",       label: "Revolut" },
    { value: "WISE",          label: "Wise" },
    { value: "BANK",          label: "Bank Transfer" },
  ],
  GBP: [
    { value: "BANK",          label: "Bank Transfer" },
    { value: "REVOLUT",       label: "Revolut" },
    { value: "WISE",          label: "Wise" },
  ],
  INR: [
    { value: "UPI",           label: "UPI" },
    { value: "IMPS",          label: "IMPS" },
    { value: "BANK",          label: "Bank Transfer" },
  ],
};

const FALLBACK: PaymentMethod[] = [{ value: "BANK", label: "Bank Transfer" }];

/** Local payment methods for a fiat (falls back to KES, then bank-only). */
export function paymentMethodsForFiat(fiat: string | null | undefined): PaymentMethod[] {
  return (fiat && PAYMENT_METHODS_BY_FIAT[fiat]) || PAYMENT_METHODS_BY_FIAT.KES || FALLBACK;
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
