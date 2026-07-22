export interface EvmToken {
  crypto: string;
  network: string;
  chainId: number;
  contract: string;
  decimals: number;
}

export const EVM_TOKEN_LIST: EvmToken[] = [
  { crypto: "ETH",   network: "ERC20",   chainId: 1,   contract: "", decimals: 18 },
  { crypto: "USDT",  network: "ERC20",   chainId: 1,   contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
  { crypto: "USDC",  network: "ERC20",   chainId: 1,   contract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  { crypto: "DAI",   network: "ERC20",   chainId: 1,   contract: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
  { crypto: "WBTC",  network: "ERC20",   chainId: 1,   contract: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
  { crypto: "LINK",  network: "ERC20",   chainId: 1,   contract: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18 },

  { crypto: "BNB",   network: "BEP20",   chainId: 56,  contract: "", decimals: 18 },
  { crypto: "USDT",  network: "BEP20",   chainId: 56,  contract: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
  { crypto: "BUSD",  network: "BEP20",   chainId: 56,  contract: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", decimals: 18 },

  { crypto: "MATIC", network: "POLYGON", chainId: 137, contract: "", decimals: 18 },
  { crypto: "POL",   network: "POLYGON", chainId: 137, contract: "", decimals: 18 }, // native gas token (MATIC renamed to POL)
  { crypto: "USDC",  network: "POLYGON", chainId: 137, contract: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
  { crypto: "USDCE", network: "POLYGON", chainId: 137, contract: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6 },
  { crypto: "USDT",  network: "POLYGON", chainId: 137, contract: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
];

export const EVM_TOKENS: Record<string, { chainId: number; contract: string; decimals: number }> =
  Object.fromEntries(EVM_TOKEN_LIST.map((token) => [
    `${token.crypto}:${token.network}`,
    { chainId: token.chainId, contract: token.contract, decimals: token.decimals },
  ]));

export function findEvmTokenByContract(chainId: number, contract: string): EvmToken | null {
  const lower = contract.toLowerCase();
  return EVM_TOKEN_LIST.find((token) =>
    token.chainId === chainId &&
    !!token.contract &&
    token.contract.toLowerCase() === lower,
  ) ?? null;
}

export function findNativeEvmToken(chainId: number): EvmToken | null {
  return EVM_TOKEN_LIST.find((token) => token.chainId === chainId && !token.contract) ?? null;
}
