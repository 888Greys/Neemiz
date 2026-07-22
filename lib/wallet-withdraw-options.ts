export const CRYPTO_WITHDRAW_ASSETS = [
  { name: "Tether USD", code: "USDT", network: "POLYGON", displayNet: "Polygon", min: 1 },
  { name: "Tether USD", code: "USDT", network: "BEP20", displayNet: "BEP-20 (BSC)", min: 1 },
  { name: "USD Coin", code: "USDC", network: "POLYGON", displayNet: "Polygon", min: 1 },
  { name: "Bitcoin", code: "BTC", network: "BITCOIN", displayNet: "Bitcoin", min: 0.0002 },
  // Native TRX — self-paying (fee from the TRX itself); signer deployed 2026-07-10.
  { name: "Tron", code: "TRX", network: "TRC20", displayNet: "Tron (native TRX)", min: 10 },
  // Native EVM coins — self-paying (gas is the coin itself). The off-box signer
  // sends a plain value transfer when the coin has no token contract. Mins carry
  // gas headroom; ETH is on L1 where gas is dear, so its min is set higher.
  { name: "Ethereum", code: "ETH", network: "ERC20", displayNet: "Ethereum (ERC-20)", min: 0.01 },
  { name: "BNB", code: "BNB", network: "BEP20", displayNet: "BNB Smart Chain", min: 0.02 },
  { name: "Polygon", code: "POL", network: "POLYGON", displayNet: "Polygon (native POL)", min: 5 },
] as const;

export type CryptoWithdrawAsset = (typeof CRYPTO_WITHDRAW_ASSETS)[number];

export const VALID_CRYPTO_WITHDRAW_NETWORKS: Record<string, string[]> = {
  USDT: ["POLYGON", "BEP20"],
  USDC: ["POLYGON"],
  BTC:  ["BITCOIN"],
  TRX:  ["TRC20"], // native TRX on Tron (self-paying)
  ETH:  ["ERC20"], // native ETH on Ethereum (self-paying)
  BNB:  ["BEP20"], // native BNB on BSC (self-paying)
  POL:  ["POLYGON"], // native POL on Polygon (self-paying)
};

export function defaultCryptoWithdrawNetwork(crypto: string): string {
  return VALID_CRYPTO_WITHDRAW_NETWORKS[crypto]?.[0] ?? "POLYGON";
}
