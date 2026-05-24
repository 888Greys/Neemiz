const DEFAULT_REFERENCE_RATES: Record<string, number> = {
  USDT: 129.5,
};

const DEFAULT_RATE_BOUNDS: Record<string, { minPct: number; maxPct: number }> = {
  USDT: { minPct: 0.9, maxPct: 1.2 },
};

export interface P2PAdGuardInput {
  crypto: string;
  pricePerUnit: number;
  availableAmount: number;
  totalAmount?: number;
  minLimit: number;
  maxLimit: number;
}

export function p2pReferenceRate(crypto: string) {
  const envKey = `P2P_${crypto.toUpperCase()}_KES_RATE`;
  const fromEnv = Number(process.env[envKey]);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return DEFAULT_REFERENCE_RATES[crypto.toUpperCase()] ?? null;
}

export function validateP2PAd(input: P2PAdGuardInput): string | null {
  const crypto = input.crypto.toUpperCase();
  const referenceRate = p2pReferenceRate(crypto);
  const bounds = DEFAULT_RATE_BOUNDS[crypto];

  if (referenceRate && bounds) {
    const minPrice = referenceRate * bounds.minPct;
    const maxPrice = referenceRate * bounds.maxPct;
    if (input.pricePerUnit < minPrice || input.pricePerUnit > maxPrice) {
      return `${crypto} price must be between KSh ${minPrice.toFixed(2)} and KSh ${maxPrice.toFixed(2)} per ${crypto}`;
    }
  }

  const remainingValue = input.availableAmount * input.pricePerUnit;
  if (remainingValue < input.minLimit) {
    return `Available ${crypto} only covers KSh ${remainingValue.toFixed(2)}, below the minimum order limit`;
  }

  const totalValue = (input.totalAmount ?? input.availableAmount) * input.pricePerUnit;
  if (input.maxLimit > totalValue) {
    return `Maximum order limit cannot exceed listed value of KSh ${totalValue.toFixed(2)}`;
  }

  return null;
}

export function isP2PAdTradable(input: P2PAdGuardInput) {
  return validateP2PAd(input) === null;
}
