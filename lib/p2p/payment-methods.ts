// ─── Region-specific P2P payment methods ──────────────────────────────────────
// Maps each supported fiat to the local payment rails people actually use, so
// the browse filter and the merchant ad form feel native per country — like
// Binance P2P. `value` is the code stored on P2PAd.paymentMethods; `label` is
// what users see.

export interface PaymentMethod {
  value: string;
  label: string;
}

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
  for (const list of Object.values(PAYMENT_METHODS_BY_FIAT)) {
    for (const pm of list) m[pm.value] = pm.label;
  }
  return m;
})();

export function paymentMethodLabel(code: string): string {
  return ALL_LABELS[code] ?? code;
}

/** Every known method code — used to validate URL/query params. */
export const ALL_PAYMENT_CODES = new Set(Object.keys(ALL_LABELS));
