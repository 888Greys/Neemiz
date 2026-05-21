import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { createPayment, toNpCurrency, getPaymentStatus } from "@/lib/nowpayments";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { defaultNetwork } from "@/lib/p2p/crypto-balance";

/**
 * GET /api/crypto/address?crypto=USDT&network=TRC20
 *   Returns the user's most-recent pending deposit address for this crypto/network,
 *   or null if none exists.
 *
 * POST /api/crypto/address
 *   Body: { crypto: "USDT", network: "TRC20", amount: 100 }
 *   Creates a new NOWPayments deposit payment and stores the address.
 *   Returns: { address, paymentId, amount, expiresAt }
 */

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser  = await getOrCreateUser(user.id, { email: user.email });
  const { searchParams } = new URL(req.url);
  const crypto  = (searchParams.get("crypto") ?? "USDT").toUpperCase();
  const network = (searchParams.get("network") ?? defaultNetwork(crypto)).toUpperCase();

  // Find the most recent pending deposit transaction for this user/crypto/network
  const pending = await db.transaction.findFirst({
    where: {
      userId:   dbUser.id,
      type:     TransactionType.DEPOSIT,
      status:   TransactionStatus.PENDING,
      provider: "nowpayments",
      currency: crypto,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!pending) return Response.json(null);

  const meta = (pending.metadata ?? {}) as Record<string, unknown>;

  // Check if the payment has expired at NOWPayments side
  const expiresAt = meta.expiresAt as string | undefined;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    // Mark expired in our DB
    await db.transaction.update({
      where: { id: pending.id },
      data:  { status: TransactionStatus.CANCELLED },
    });
    return Response.json(null);
  }

  return Response.json({
    address:   meta.address,
    paymentId: pending.reference,
    network,
    amount:    Number(pending.amount),
    expiresAt: meta.expiresAt,
    createdAt: pending.createdAt,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  let body: { crypto: string; network?: string; amount: number };
  try   { body = await req.json(); }
  catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }

  const crypto  = (body.crypto ?? "USDT").toUpperCase();
  const network = (body.network ?? defaultNetwork(crypto)).toUpperCase();
  const amount  = Number(body.amount);

  if (!amount || amount <= 0) {
    return Response.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }

  const payCurrency = toNpCurrency(crypto, network);

  let payment;
  try {
    payment = await createPayment({
      payCurrency,
      priceAmount: amount,
      orderId:     dbUser.id,
    });
  } catch (err: unknown) {
    console.error("NOWPayments createPayment error:", err);
    return Response.json(
      { error: (err as Error).message ?? "Failed to create deposit address" },
      { status: 502 },
    );
  }

  // Persist the address and payment reference
  await db.$transaction(async (tx) => {
    // Store/update the deposit address for quick lookup
    await tx.cryptoDepositAddress.upsert({
      where:  { userId_crypto_network: { userId: dbUser.id, crypto, network } },
      update: { address: payment.pay_address },
      create: { userId: dbUser.id, crypto, network, address: payment.pay_address },
    });

    // Create a pending transaction to track this deposit
    await tx.transaction.create({
      data: {
        userId:    dbUser.id,
        type:      TransactionType.DEPOSIT,
        amount,
        currency:  crypto,
        status:    TransactionStatus.PENDING,
        reference: payment.payment_id,
        provider:  "nowpayments",
        metadata:  {
          address:     payment.pay_address,
          network,
          payCurrency,
          payAmount:   payment.pay_amount,
          expiresAt:   payment.expiration_estimate_date,
        },
      },
    });
  });

  return Response.json({
    address:   payment.pay_address,
    paymentId: payment.payment_id,
    network,
    crypto,
    amount,
    expiresAt: payment.expiration_estimate_date,
  }, { status: 201 });
}
