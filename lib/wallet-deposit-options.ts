/**
 * Custodial wallet deposit options — international.
 * Local methods come from the market catalogue; crypto is always global.
 */
import {
  GLOBAL_CRYPTO_METHODS,
  marketForCurrency,
  type Market,
} from "@/lib/payments/country-methods";
import { METHOD_REGISTRY, methodLabel, type MethodCode } from "@/lib/payments/method-registry";

export type CryptoAssetGroup = "USDT" | "BTC" | "ETH" | "OTHER";

export type DepositSelection =
  | { kind: "mpesa" }
  | { kind: "pesapal" }
  | { kind: "crypto"; assetGroup: CryptoAssetGroup };

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

  // Cards collapse to one Pesapal row (Visa + Mastercard shown via logos in UI).
  if (def.walletRail === "pesapal") {
    if (code !== "VISA") return null; // only emit once
    return {
      id: "card",
      code: "VISA",
      label: "Credit / Debit Card",
      subtitle: "Visa · Mastercard · International",
      enabled: opts.pesapalEnabled,
      soon: !opts.pesapalEnabled,
      selection: opts.pesapalEnabled ? { kind: "pesapal" } : undefined,
    };
  }

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

  if (def.walletRail === "crypto" && def.cryptoGroup) {
    const live = !!def.walletLive;
    return {
      id: `crypto-${code}`,
      code,
      label: def.label,
      subtitle: "On-chain · Global",
      enabled: live,
      soon: !live,
      selection: live ? { kind: "crypto", assetGroup: def.cryptoGroup } : undefined,
    };
  }

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
    // Skip raw MASTERCARD — folded into card row via VISA.
    if (code === "MASTERCARD" || code === "AMEX") {
      if (!seen.has("card")) {
        push(walletRowForCode("VISA", { pesapalEnabled: opts.pesapalEnabled, region: market.region }));
      }
      continue;
    }
    push(walletRowForCode(code, { pesapalEnabled: opts.pesapalEnabled, region: market.region }));
  }

  for (const code of GLOBAL_CRYPTO_METHODS) {
    push(walletRowForCode(code, { pesapalEnabled: opts.pesapalEnabled, region: "Global" }));
  }

  // Live methods first, then soon.
  return rows.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.label.localeCompare(b.label));
}

/** @deprecated Prefer depositRowsForCurrency — kept for older imports. */
export const DEPOSIT_METHOD_ROWS: DepositMethodRow[] = depositRowsForCurrency("KES", {
  pesapalEnabled: false,
});

export const CRYPTO_DEPOSIT_ASSETS = [
  { name: "Tether USD", code: "USDT", network: "POLYGON", displayNet: "Polygon", min: 1, enabled: true, soon: false },
  { name: "Tether USD", code: "USDT", network: "BEP20", displayNet: "BEP-20 (BSC)", min: 1, enabled: false, soon: true },
  { name: "USD Coin", code: "USDC", network: "POLYGON", displayNet: "Polygon", min: 1, enabled: true, soon: false },
  { name: "Bitcoin", code: "BTC", network: "BITCOIN", displayNet: "Bitcoin", min: 0.0001, enabled: true, soon: false },
] as const;

export const VALID_CRYPTO_DEPOSIT_NETWORKS: Record<string, string[]> = {
  USDT: ["POLYGON"],
  USDC: ["POLYGON"],
  BTC: ["BITCOIN"],
};
