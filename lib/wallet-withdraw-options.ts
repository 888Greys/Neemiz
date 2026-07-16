export const CRYPTO_WITHDRAW_ASSETS = [
  { name: "Tether USD", code: "USDT", network: "POLYGON", displayNet: "Polygon", min: 1 },
  { name: "USD Coin", code: "USDC", network: "POLYGON", displayNet: "Polygon", min: 1 },
  { name: "Bitcoin", code: "BTC", network: "BITCOIN", displayNet: "Bitcoin", min: 0.0002 },
  // Native TRX — self-paying (fee from the TRX itself); signer deployed 2026-07-10.
  { name: "Tron", code: "TRX", network: "TRC20", displayNet: "Tron (native TRX)", min: 10 },
  // Native EVM coins — self-paying (fee is the coin itself). broadcastEVM sends
  // native value directly when the crypto has no token contract; hot wallet fronts
  // gas in the same coin, exactly like the Polygon stables today.
  { name: "Ethereum", code: "ETH", network: "ERC20", displayNet: "Ethereum", min: 0.005 },
  { name: "BNB", code: "BNB", network: "BEP20", displayNet: "BNB Smart Chain", min: 0.01 },
  { name: "Polygon", code: "POL", network: "POLYGON", displayNet: "Polygon (native POL)", min: 2 },
  // Litecoin — UTXO, self-paying (fee out of the LTC being moved, no gas top-up).
  { name: "Litecoin", code: "LTC", network: "LITECOIN", displayNet: "Litecoin", min: 0.01 },
] as const;

export type CryptoWithdrawAsset = (typeof CRYPTO_WITHDRAW_ASSETS)[number];

export const VALID_CRYPTO_WITHDRAW_NETWORKS: Record<string, string[]> = {
  USDT: ["POLYGON"],
  USDC: ["POLYGON"],
  BTC:  ["BITCOIN"],
  TRX:  ["TRC20"], // native TRX on Tron (self-paying)
  ETH:  ["ERC20"], // native ETH on Ethereum mainnet (self-paying)
  BNB:  ["BEP20"], // native BNB on BNB Smart Chain (self-paying)
  POL:  ["POLYGON"], // native POL on Polygon (self-paying)
  LTC:  ["LITECOIN"], // UTXO, self-paying (reuses BTC key + signer)
};

export function defaultCryptoWithdrawNetwork(crypto: string): string {
  return VALID_CRYPTO_WITHDRAW_NETWORKS[crypto]?.[0] ?? "POLYGON";
}
