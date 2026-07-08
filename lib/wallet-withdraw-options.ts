export const CRYPTO_WITHDRAW_ASSETS = [
  { name: "Tether USD", code: "USDT", network: "POLYGON", displayNet: "Polygon", min: 1 },
  { name: "USD Coin", code: "USDC", network: "POLYGON", displayNet: "Polygon", min: 1 },
  { name: "Bitcoin", code: "BTC", network: "BITCOIN", displayNet: "Bitcoin", min: 0.0002 },
] as const;

export type CryptoWithdrawAsset = (typeof CRYPTO_WITHDRAW_ASSETS)[number];

export const VALID_CRYPTO_WITHDRAW_NETWORKS: Record<string, string[]> = {
  USDT: ["POLYGON"],
  USDC: ["POLYGON"],
  BTC:  ["BITCOIN"],
};

export function defaultCryptoWithdrawNetwork(crypto: string): string {
  return VALID_CRYPTO_WITHDRAW_NETWORKS[crypto]?.[0] ?? "POLYGON";
}
