export const CRYPTO_WITHDRAW_ASSETS = [
  { name: "Tether USD", code: "USDT", network: "POLYGON", displayNet: "Polygon", min: 1 },
  { name: "USD Coin", code: "USDC", network: "POLYGON", displayNet: "Polygon", min: 1 },
  { name: "Bitcoin", code: "BTC", network: "BITCOIN", displayNet: "Bitcoin", min: 0.0002 },
  // Native TRX — self-paying (fee from the TRX itself); signer deployed 2026-07-10.
  { name: "Tron", code: "TRX", network: "TRC20", displayNet: "Tron (native TRX)", min: 10 },
] as const;

export type CryptoWithdrawAsset = (typeof CRYPTO_WITHDRAW_ASSETS)[number];

export const VALID_CRYPTO_WITHDRAW_NETWORKS: Record<string, string[]> = {
  USDT: ["POLYGON"],
  USDC: ["POLYGON"],
  BTC:  ["BITCOIN"],
  TRX:  ["TRC20"], // native TRX on Tron (self-paying)
};

export function defaultCryptoWithdrawNetwork(crypto: string): string {
  return VALID_CRYPTO_WITHDRAW_NETWORKS[crypto]?.[0] ?? "POLYGON";
}
