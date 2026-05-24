import {
  Chain,
  ClobClient,
  OrderType,
  Side,
  SignatureTypeV2,
  type ApiKeyCreds,
  type OrderResponse,
} from "@polymarket/clob-client-v2";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

type TickSize = "0.1" | "0.01" | "0.001" | "0.0001";

export interface PlacedPolymarketOrder {
  orderId: string | null;
  status: string;
  success: boolean;
  tradeIds: string[];
  transactionHashes: string[];
  raw: OrderResponse;
}

interface PlaceBuyOrderInput {
  tokenId: string;
  usdcAmount: number;
  price?: number;
}

export function isClobTradingEnabled() {
  return process.env.POLYMARKET_TRADING_MODE?.toLowerCase() === "clob";
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function parseChain(): Chain {
  const chainId = Number(process.env.POLYMARKET_CHAIN_ID ?? Chain.POLYGON);
  if (chainId === Chain.AMOY) return Chain.AMOY;
  return Chain.POLYGON;
}

function parseSignatureType(): SignatureTypeV2 {
  const raw = Number(process.env.POLYMARKET_SIGNATURE_TYPE ?? SignatureTypeV2.EOA);
  if (raw === SignatureTypeV2.POLY_PROXY) return SignatureTypeV2.POLY_PROXY;
  if (raw === SignatureTypeV2.POLY_GNOSIS_SAFE) return SignatureTypeV2.POLY_GNOSIS_SAFE;
  if (raw === SignatureTypeV2.POLY_1271) return SignatureTypeV2.POLY_1271;
  return SignatureTypeV2.EOA;
}

function parseOrderType(): OrderType.FOK | OrderType.FAK {
  return process.env.POLYMARKET_ORDER_TYPE?.toUpperCase() === OrderType.FAK
    ? OrderType.FAK
    : OrderType.FOK;
}

function parseTickSize(): TickSize {
  const raw = process.env.POLYMARKET_TICK_SIZE ?? "0.01";
  return raw === "0.1" || raw === "0.001" || raw === "0.0001" ? raw : "0.01";
}

function getStoredCreds(): ApiKeyCreds | undefined {
  const key = process.env.POLYMARKET_API_KEY?.trim();
  const secret = process.env.POLYMARKET_API_SECRET?.trim();
  const passphrase = process.env.POLYMARKET_API_PASSPHRASE?.trim();
  if (!key && !secret && !passphrase) return undefined;
  if (!key || !secret || !passphrase) {
    throw new Error("POLYMARKET_API_KEY, POLYMARKET_API_SECRET and POLYMARKET_API_PASSPHRASE must be set together");
  }
  return { key, secret, passphrase };
}

async function getClobClient() {
  const privateKey = requiredEnv("POLYMARKET_PRIVATE_KEY") as `0x${string}`;
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    transport: http(process.env.POLYMARKET_RPC_URL),
  });

  const host = process.env.POLYMARKET_CLOB_HOST ?? "https://clob.polymarket.com";
  const chain = parseChain();
  const signatureType = parseSignatureType();
  const funderAddress = process.env.POLYMARKET_FUNDER_ADDRESS?.trim() || undefined;
  const baseOptions = {
    host,
    chain,
    signer: walletClient,
    signatureType,
    funderAddress,
    useServerTime: true,
    retryOnError: true,
  };

  let creds = getStoredCreds();
  if (!creds) {
    if (process.env.POLYMARKET_DERIVE_API_KEY?.toLowerCase() !== "true") {
      throw new Error("Missing Polymarket API credentials. Set POLYMARKET_DERIVE_API_KEY=true to derive them at runtime.");
    }
    creds = await new ClobClient(baseOptions).createOrDeriveApiKey();
  }

  return new ClobClient({ ...baseOptions, creds });
}

export async function placePolymarketBuyOrder(input: PlaceBuyOrderInput): Promise<PlacedPolymarketOrder> {
  if (!input.tokenId) throw new Error("Missing Polymarket CLOB token id");
  if (!Number.isFinite(input.usdcAmount) || input.usdcAmount <= 0) {
    throw new Error("Polymarket order amount must be greater than zero");
  }

  const client = await getClobClient();
  const orderType = parseOrderType();
  const response = await client.createAndPostMarketOrder(
    {
      tokenID: input.tokenId,
      amount: Number(input.usdcAmount.toFixed(2)),
      price: input.price,
      side: Side.BUY,
      orderType,
    },
    { tickSize: parseTickSize() },
    orderType,
  ) as OrderResponse;

  if (!response.success) {
    throw new Error(response.errorMsg || "Polymarket CLOB order was rejected");
  }

  return {
    orderId: response.orderID ?? null,
    status: response.status ?? "UNKNOWN",
    success: response.success,
    tradeIds: response.tradeIDs ?? [],
    transactionHashes: response.transactionsHashes ?? [],
    raw: response,
  };
}
