export type CryptoAssetGroup = "USDT" | "BTC" | "ETH" | "OTHER";

export type DepositSelection =
  | { kind: "mpesa" }
  | { kind: "pesapal" }
  | { kind: "crypto"; assetGroup: CryptoAssetGroup };

export type DepositMethodRow = {
  id: string;
  label: string;
  badges: string[];
  enabled: boolean;
  soon: boolean;
  selection?: DepositSelection;
};

export const DEPOSIT_METHOD_ROWS: DepositMethodRow[] = [
  { id: "card", label: "Credit/Debit Card", badges: ["VISA", "MC"], enabled: false, soon: false, selection: { kind: "pesapal" } },
  { id: "mpesa", label: "Mobile money", badges: ["AIRTEL", "MPESA"], enabled: true, soon: false, selection: { kind: "mpesa" } },
  { id: "usdt", label: "USDT", badges: ["USDT"], enabled: true, soon: false, selection: { kind: "crypto", assetGroup: "USDT" } },
  { id: "btc", label: "Bitcoin", badges: ["BTC"], enabled: true, soon: false, selection: { kind: "crypto", assetGroup: "BTC" } },
  { id: "eth", label: "Ethereum", badges: ["ETH"], enabled: false, soon: true },
  { id: "other", label: "Other Crypto", badges: ["USDC", "BINANCE"], enabled: true, soon: false, selection: { kind: "crypto", assetGroup: "OTHER" } },
  { id: "bank", label: "Bank Transfer", badges: ["BANK"], enabled: false, soon: true },
];

export const CRYPTO_DEPOSIT_ASSETS = [
  { name: "Tether USD", code: "USDT", network: "POLYGON", displayNet: "Polygon", min: 1, enabled: true, soon: false },
  { name: "Tether USD", code: "USDT", network: "BEP20", displayNet: "BEP-20 (BSC)", min: 1, enabled: false, soon: true },
  { name: "USD Coin", code: "USDC", network: "POLYGON", displayNet: "Polygon", min: 1, enabled: true, soon: false },
  { name: "Bitcoin", code: "BTC", network: "BITCOIN", displayNet: "Bitcoin", min: 0.0001, enabled: true, soon: false },
] as const;

export const VALID_CRYPTO_DEPOSIT_NETWORKS: Record<string, string[]> = {
  USDT: ["POLYGON"],
  USDC: ["POLYGON"],
  BTC:  ["BITCOIN"],
};
