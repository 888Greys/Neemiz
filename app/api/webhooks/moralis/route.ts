import { db } from "@/lib/db";
import { creditOnChainDeposit, notifyPendingDeposit } from "@/lib/crypto/deposit-credit";
import { verifyMoralisSignature } from "@/lib/crypto/moralis";
import { findEvmTokenByContract, findNativeEvmToken } from "@/lib/crypto/token-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MoralisWebhookPayload {
  confirmed?: boolean;
  chainId?: string;
  streamId?: string;
  tag?: string;
  retries?: number;
  block?: {
    number?: string;
    hash?: string;
    timestamp?: string;
  };
  logs?: Array<unknown>;
  txsInternal?: Array<unknown>;
  erc20Transfers?: Array<{
    transactionHash?: string;
    logIndex?: string;
    contract?: string;
    from?: string;
    to?: string;
    value?: string;
    tokenDecimals?: string;
    valueWithDecimals?: string;
  }>;
  erc20Approvals?: Array<unknown>;
  nftTransfers?: Array<unknown>;
  txs?: Array<{
    hash?: string;
    transactionHash?: string;
    fromAddress?: string;
    from?: string;
    toAddress?: string;
    to?: string;
    value?: string;
  }>;
}

function parseChainId(chainId?: string): number | null {
  if (!chainId) return null;
  const parsed = chainId.startsWith("0x") ? Number.parseInt(chainId, 16) : Number.parseInt(chainId, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRawUnits(value: string, decimals: number): number {
  const raw = BigInt(value);
  const base = BigInt(10) ** BigInt(decimals);
  const whole = raw / base;
  const fraction = raw % base;
  return Number(`${whole}.${fraction.toString().padStart(decimals, "0").slice(0, 8)}`);
}

function isMoralisTestWebhook(payload: MoralisWebhookPayload): boolean {
  return payload.confirmed === true &&
    !payload.chainId &&
    !payload.streamId &&
    (payload.txs?.length ?? 0) === 0 &&
    (payload.txsInternal?.length ?? 0) === 0 &&
    (payload.logs?.length ?? 0) === 0 &&
    (payload.erc20Transfers?.length ?? 0) === 0 &&
    (payload.erc20Approvals?.length ?? 0) === 0 &&
    (payload.nftTransfers?.length ?? 0) === 0;
}

// mode "credit" = the tx is confirmed → credit + "received" notification/email.
// mode "pending" = seen on-chain but not yet confirmed → fire the one-time
// "detected, awaiting confirmation" heads-up only (no crediting).
async function processDepositTransfer(mode: "credit" | "pending", input: {
  chainId: number;
  crypto: string;
  network: string;
  amount: number;
  txHash: string;
  logIndex?: string;
  from?: string;
  to?: string;
  sourceMeta: Record<string, unknown>;
}) {
  if (!input.to) return { credited: false, skipped: true, reason: "missing_to" };

  const depositAddress = await db.cryptoDepositAddress.findFirst({
    where: {
      crypto:  input.crypto,
      network: input.network,
      address: { equals: input.to, mode: "insensitive" },
    },
    include: { user: { include: { merchantProfile: true } } },
  });

  if (!depositAddress) return { credited: false, skipped: true, reason: "unknown_deposit_address" };

  if (mode === "pending") {
    const r = await notifyPendingDeposit({
      user:           depositAddress.user,
      depositAddress: depositAddress.address,
      crypto:         input.crypto,
      network:        input.network,
      amount:         input.amount,
      txHash:         input.txHash,
      logIndex:       input.logIndex,
    });
    return { credited: false, skipped: !r.notified, reason: r.reason };
  }

  return creditOnChainDeposit({
    user:           depositAddress.user,
    depositAddress: depositAddress.address,
    crypto:         input.crypto,
    network:        input.network,
    amount:         input.amount,
    txHash:         input.txHash,
    logIndex:       input.logIndex,
    from:           input.from,
    source:         "moralis",
    metadata:       input.sourceMeta,
  });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!rawBody.trim()) {
    return Response.json({ ok: true, test: true });
  }

  let payload: MoralisWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MoralisWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (isMoralisTestWebhook(payload)) {
    return Response.json({ ok: true, test: true });
  }

  if (!verifyMoralisSignature(payload, req.headers.get("x-signature"))) {
    console.warn("[moralis] invalid webhook signature");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Moralis fires this webhook twice: confirmed:false when the tx is first seen
  // in a block, then confirmed:true after the stream's confirmation depth. We
  // send a "detected" heads-up on the first and credit on the second.
  const mode: "credit" | "pending" = payload.confirmed ? "credit" : "pending";

  const chainId = parseChainId(payload.chainId);
  if (!chainId) return Response.json({ ok: true, ignored: "missing_chain" });

  let credited = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const transfer of payload.erc20Transfers ?? []) {
    try {
      if (!transfer.transactionHash || !transfer.contract) { skipped++; continue; }
      const token = findEvmTokenByContract(chainId, transfer.contract);
      if (!token) { skipped++; continue; }

      const amount = transfer.valueWithDecimals != null
        ? Number(transfer.valueWithDecimals)
        : formatRawUnits(transfer.value ?? "0", Number(transfer.tokenDecimals ?? token.decimals));
      if (!Number.isFinite(amount) || amount <= 0) { skipped++; continue; }

      const result = await processDepositTransfer(mode, {
        chainId,
        crypto:     token.crypto,
        network:    token.network,
        amount,
        txHash:     transfer.transactionHash,
        logIndex:   transfer.logIndex,
        from:       transfer.from,
        to:         transfer.to,
        sourceMeta: {
          streamId: payload.streamId,
          tag:      payload.tag,
          retries:  payload.retries,
          block:    payload.block,
          chainId:  payload.chainId,
          contract: transfer.contract,
        },
      });

      if (result.credited) credited++;
      else skipped++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "erc20_processing_failed";
      errors.push(msg);
      console.error("[moralis] ERC20 transfer processing failed:", msg);
    }
  }

  const nativeToken = findNativeEvmToken(chainId);
  if (nativeToken) {
    for (const tx of payload.txs ?? []) {
      try {
        const txHash = tx.transactionHash ?? tx.hash;
        const amount = tx.value ? formatRawUnits(tx.value, nativeToken.decimals) : 0;
        if (!txHash || amount <= 0) { skipped++; continue; }

        const result = await processDepositTransfer(mode, {
          chainId,
          crypto:     nativeToken.crypto,
          network:    nativeToken.network,
          amount,
          txHash,
          from:       tx.fromAddress ?? tx.from,
          to:         tx.toAddress ?? tx.to,
          sourceMeta: {
            streamId: payload.streamId,
            tag:      payload.tag,
            retries:  payload.retries,
            block:    payload.block,
            chainId:  payload.chainId,
            native:   true,
          },
        });

        if (result.credited) credited++;
        else skipped++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "native_processing_failed";
        errors.push(msg);
        console.error("[moralis] native transfer processing failed:", msg);
      }
    }
  }

  if (errors.length) {
    return Response.json({ ok: false, mode, credited, skipped, errors }, { status: 500 });
  }

  return Response.json({ ok: true, mode, credited, skipped });
}
