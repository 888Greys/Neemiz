/**
 * Custodial wallet deposit options — international.
 * Local methods come from the market catalogue; crypto is always global.
 */
import {
  marketForCurrency,
  type Market,
} from "@/lib/payments/country-methods";
import { METHOD_REGISTRY, methodLabel, type MethodCode } from "@/lib/payments/method-registry";

export type DepositSelection =
  | { kind: "mpesa" }
  | { kind: "pesapal" }
  | { kind: "crypto" };

export type DepositMethodRow = {
  id: string;
  code: MethodCode;
  label: string;
  subtitle: string;
  enabled: boolean;
  soon: boolean;
  selection?: DepositSelection;
};

function walletRowForCode(
  code: MethodCode,
  opts: { pesapalEnabled: boolean; region: string },
): DepositMethodRow | null {
  const def = METHOD_REGISTRY[code];
  if (!def) return null;

  // Cards (Pesapal) temporarily removed from the wallet deposit picker.
  if (def.walletRail === "pesapal") return null;

  if (def.walletRail === "mpesa") {
    return {
      id: "mpesa",
      code: "MPESA",
      label: "M-Pesa",
      subtitle: `${opts.region} · Instant mobile money`,
      enabled: true,
      soon: false,
      selection: { kind: "mpesa" },
    };
  }

  // Per-coin crypto rows are collapsed into a single "Crypto" method below.
  if (def.walletRail === "crypto") return null;

  // Coming soon — still shown so the product reads international.
  return {
    id: code.toLowerCase(),
    code,
    label: methodLabel(code),
    subtitle: `${opts.region} · Coming soon`,
    enabled: false,
    soon: true,
  };
}

/** Build deposit rows for a market currency (+ always-on crypto). */
export function depositRowsForCurrency(
  currency: string,
  opts: { pesapalEnabled: boolean },
): DepositMethodRow[] {
  const market: Market = marketForCurrency(currency);
  const seen = new Set<string>();
  const rows: DepositMethodRow[] = [];

  const push = (row: DepositMethodRow | null) => {
    if (!row || seen.has(row.id)) return;
    seen.add(row.id);
    rows.push(row);
  };

  for (const code of market.methods) {
    // Card rails temporarily removed — skip Visa/MC/Amex entirely.
    if (code === "VISA" || code === "MASTERCARD" || code === "AMEX") continue;
    push(walletRowForCode(code, { pesapalEnabled: opts.pesapalEnabled, region: market.region }));
  }

  // One Crypto entry — coin + network are chosen in the deposit detail steps.
  push({
    id: "crypto",
    code: "CRYPTO",
    label: "Crypto",
    subtitle: "On-chain · Global",
    enabled: true,
    soon: false,
    selection: { kind: "crypto" },
  });

  // Live methods first, then soon.
  return rows.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.label.localeCompare(b.label));
}

/** @deprecated Prefer depositRowsForCurrency — kept for older imports. */
export const DEPOSIT_METHOD_ROWS: DepositMethodRow[] = depositRowsForCurrency("KES", {
  pesapalEnabled: false,
});

// Self-paying native coins (fees paid in the same asset — no separate gas
// hot-wallet, unlike USDT-TRC20/ERC20/BEP20). Listed as `soon` until deposit
// AND withdraw are wired end-to-end; then flip `enabled: true, soon: false`.
// See docs/NATIVE-CRYPTO-LISTING-PLAN.md.
export const CRYPTO_DEPOSIT_ASSETS = [
  { name: "Tether USD", code: "USDT", network: "POLYGON", displayNet: "Polygon", min: 1, enabled: true, soon: false },
  { name: "Tether USD", code: "USDT", network: "BEP20", displayNet: "BEP-20 (BSC)", min: 1, enabled: false, soon: true },
  { name: "USD Coin", code: "USDC", network: "POLYGON", displayNet: "Polygon", min: 1, enabled: true, soon: false },
  { name: "Bitcoin", code: "BTC", network: "BITCOIN", displayNet: "Bitcoin", min: 0.0001, enabled: true, soon: false },
  // Native coins — fees paid in the coin itself.
  // TRX uses the shared Tron network id "TRC20" (same Tron address family as
  // USDT-TRC20) so it reuses the existing derivation / deposit-checker / signer
  // routing; displayNet keeps it visually distinct from the USDT-TRC20 token.
  // LIVE: native-TRX signer deployed to soi 2026-07-10 (self-paying withdrawals).
  { name: "Tron", code: "TRX", network: "TRC20", displayNet: "Tron (native TRX)", min: 10, enabled: true, soon: false },
  { name: "Ethereum", code: "ETH", network: "ETHEREUM", displayNet: "Ethereum", min: 0.001, enabled: false, soon: true },
  { name: "BNB", code: "BNB", network: "BEP20", displayNet: "BNB Smart Chain", min: 0.005, enabled: false, soon: true },
  { name: "Polygon", code: "POL", network: "POLYGON", displayNet: "Polygon (native POL)", min: 1, enabled: false, soon: true },
  { name: "Solana", code: "SOL", network: "SOLANA", displayNet: "Solana", min: 0.02, enabled: false, soon: true },
  { name: "Litecoin", code: "LTC", network: "LITECOIN", displayNet: "Litecoin", min: 0.001, enabled: false, soon: true },
  { name: "XRP", code: "XRP", network: "XRPL", displayNet: "XRP Ledger", min: 1, enabled: false, soon: true },
  { name: "Dogecoin", code: "DOGE", network: "DOGECOIN", displayNet: "Dogecoin", min: 10, enabled: false, soon: true },
  { name: "Bitcoin Cash", code: "BCH", network: "BITCOINCASH", displayNet: "Bitcoin Cash", min: 0.001, enabled: false, soon: true },
] as const;

export const VALID_CRYPTO_DEPOSIT_NETWORKS: Record<string, string[]> = {
  USDT: ["POLYGON"],
  USDC: ["POLYGON"],
  BTC: ["BITCOIN"],
  TRX: ["TRC20"], // native TRX on Tron (self-paying)
};
