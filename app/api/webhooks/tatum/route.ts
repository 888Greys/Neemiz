import { db } from "@/lib/db";
import { creditOnChainDeposit, notifyPendingDeposit } from "@/lib/crypto/deposit-credit";
import { isTatumWebhookSecretConfigured, verifyTatumPayload } from "@/lib/crypto/tatum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TatumWebhookPayload {
  address?: string;
  amount?: string | number;
  asset?: string;
  blockNumber?: string | number;
  blockTimestamp?: string | number;
  chain?: string;
  contractAddress?: string;
  counterAddress?: string;
  currency?: string;
  subscriptionId?: string;
  subscriptionType?: string;
  txId?: string;
  type?: string;
  data?: {
    address?: string;
    amount?: string | number;
    asset?: string;
    blockNumber?: string | number;
    blockTimestamp?: string | number;
    chain?: string;
    contractAddress?: string;
    counterAddress?: string;
    currency?: string;
    from?: string;
    kind?: string;
    subscriptionId?: string;
    subscriptionType?: string;
    to?: string;
    txId?: string;
    txTimestamp?: string | number;
    type?: string;
    value?: string | number;
    tokenMetadata?: {
      decimals?: string | number;
      symbol?: string;
      type?: string;
    };
  };
}

interface NormalizedTatumDeposit {
  crypto: string;
  network: string;
  amount: number;
  txHash: string;
  to: string;
  from?: string;
  chain?: string;
  blockNumber?: string | number;
  blockTimestamp?: string | number;
  subscriptionId?: string;
  subscriptionType?: string;
  webhookType?: string;
}

const TRON_USDT_CONTRACTS = new Set([
  "tr7nhqjeqkxgtci8q8zy4pl8otszgjlj6t",
  "usdt_tron",
]);

function firstString(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function rawUnitsToNumber(value: string | number | undefined, decimals: number): number {
  if (value == null) return 0;
  const rawText = String(value);
  if (!/^\d+$/.test(rawText)) return Number(rawText);

  const raw = BigInt(rawText);
  const base = BigInt(10) ** BigInt(decimals);
  const whole = raw / base;
  const fraction = raw % base;
  return Number(`${whole}.${fraction.toString().padStart(decimals, "0").slice(0, 8)}`);
}

function normalizeAsset(asset?: string): string | undefined {
  if (!asset) return undefined;
  const upper = asset.toUpperCase();
  if (upper === "TRON") return "TRX";
  if (upper.endsWith("_TRON")) return upper.replace(/_TRON$/, "");
  return upper;
}

function mapTatumCoin(input: {
  chain?: string;
  asset?: string;
  currency?: string;
  contractAddress?: string;
  tokenSymbol?: string;
}): { crypto: string; network: string } | null {
  const chain = input.chain?.toLowerCase() ?? "";
  const contract = input.contractAddress?.toLowerCase();
  const symbol = normalizeAsset(input.tokenSymbol ?? input.asset ?? input.currency);

  if (chain.includes("bitcoin") || chain === "btc" || symbol === "BTC") {
    return { crypto: "BTC", network: "BITCOIN" };
  }

  if (chain.includes("tron") || chain === "trx" || symbol === "TRX" || TRON_USDT_CONTRACTS.has(contract ?? "")) {
    if (symbol === "USDT" || TRON_USDT_CONTRACTS.has(contract ?? "")) {
      return { crypto: "USDT", network: "TRC20" };
    }
    if (symbol === "TRX") {
      return { crypto: "TRX", network: "TRC20" };
    }
  }

  return null;
}

function normalizeTatumPayload(payload: TatumWebhookPayload): NormalizedTatumDeposit | null {
  const data = payload.data;
  const chain = firstString(data?.chain, payload.chain);
  const asset = firstString(data?.asset, payload.asset);
  const currency = firstString(data?.currency, payload.currency);
  const contractAddress = firstString(data?.contractAddress, payload.contractAddress);
  const tokenSymbol = firstString(data?.tokenMetadata?.symbol);
  const coin = mapTatumCoin({ chain, asset, currency, contractAddress, tokenSymbol });
  if (!coin) return null;

  const txHash = firstString(data?.txId, payload.txId);
  const to = firstString(data?.to, data?.address, payload.address);
  if (!txHash || !to) return null;

  const amount = data?.amount ?? payload.amount;
  const decimals = Number(data?.tokenMetadata?.decimals ?? (coin.crypto === "BTC" ? 8 : 6));
  const parsedAmount = amount != null
    ? Number(amount)
    : rawUnitsToNumber(data?.value, Number.isFinite(decimals) ? decimals : 6);

  return {
    crypto:           coin.crypto,
    network:          coin.network,
    amount:           parsedAmount,
    txHash,
    to,
    from:             firstString(data?.from, data?.counterAddress, payload.counterAddress),
    chain,
    blockNumber:      data?.blockNumber ?? payload.blockNumber,
    blockTimestamp:   data?.blockTimestamp ?? data?.txTimestamp ?? payload.blockTimestamp,
    subscriptionId:   firstString(data?.subscriptionId, payload.subscriptionId),
    subscriptionType: firstString(data?.subscriptionType, payload.subscriptionType),
    webhookType:      firstString(data?.kind, data?.type, payload.type),
  };
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!rawBody.trim()) {
    return Response.json({ ok: true, test: true });
  }

  let payload: TatumWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as TatumWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isTatumWebhookSecretConfigured()) {
    return Response.json({ error: "TATUM_WEBHOOK_SECRET is not configured" }, { status: 503 });
  }

  if (!verifyTatumPayload(payload, req.headers.get("x-payload-hash"))) {
    console.warn("[tatum] invalid webhook signature");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const deposit = normalizeTatumPayload(payload);
  if (!deposit) {
    return Response.json({ ok: true, ignored: "unsupported_or_incomplete_payload" });
  }

  if (!Number.isFinite(deposit.amount) || deposit.amount <= 0) {
    return Response.json({ ok: true, ignored: "invalid_amount" });
  }

  const depositAddress = await db.cryptoDepositAddress.findFirst({
    where: {
      crypto:  deposit.crypto,
      network: deposit.network,
      address: { equals: deposit.to, mode: "insensitive" },
    },
    include: { user: { include: { merchantProfile: true } } },
  });

  if (!depositAddress) {
    return Response.json({ ok: true, ignored: "unknown_deposit_address" });
  }

  // Tatum may fire when a BTC/TRC20 tx is first seen (mempool / 0-conf) and again
  // after it lands in a block. Mirror Moralis: pending → "Deposit detected"
  // heads-up only; confirmed (blockNumber present) → credit + "received".
  const blockNum = Number(deposit.blockNumber);
  const confirmed = Number.isFinite(blockNum) && blockNum > 0;

  if (!confirmed) {
    const pending = await notifyPendingDeposit({
      user:           depositAddress.user,
      depositAddress: depositAddress.address,
      crypto:         deposit.crypto,
      network:        deposit.network,
      amount:         deposit.amount,
      txHash:         deposit.txHash,
    });
    return Response.json({
      ok:        true,
      credited:  0,
      notified:  pending.notified ? 1 : 0,
      skipped:   pending.notified ? 0 : 1,
      reason:    pending.reason ?? "pending_unconfirmed",
    });
  }

  const result = await creditOnChainDeposit({
    user:           depositAddress.user,
    depositAddress: depositAddress.address,
    crypto:         deposit.crypto,
    network:        deposit.network,
    amount:         deposit.amount,
    txHash:         deposit.txHash,
    from:           deposit.from,
    source:         "tatum",
    metadata: {
      chain:            deposit.chain,
      blockNumber:      deposit.blockNumber,
      blockTimestamp:   deposit.blockTimestamp,
      subscriptionId:   deposit.subscriptionId,
      subscriptionType: deposit.subscriptionType,
      webhookType:      deposit.webhookType,
    },
  });

  return Response.json({
    ok:       true,
    credited: result.credited ? 1 : 0,
    skipped:  result.skipped ? 1 : 0,
    reason:   result.reason,
  });
}
