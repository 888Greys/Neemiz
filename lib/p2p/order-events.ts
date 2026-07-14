import type { Prisma } from "@prisma/client";

type TxClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// Warning posted ~10 min before a PENDING order's payment window closes.
export const ORDER_EXPIRING_SOON_TEXT =
  "This trade is about to expire. Please do not make any further payments related to this trade.";

// Posted when a PENDING order expires (payment window passed, escrow released).
export function orderExpiredSystemText(crypto: string) {
  return `This trade has expired, and ${crypto} is no longer reserved in escrow. Do not make any payments to the previously provided payment details, as they may no longer be valid. If you wish to continue, ask your trade partner to reopen the trade and ensure ${crypto} is reserved again before making any payment.`;
}

export async function createP2POrderEventMessage(
  tx: TxClient,
  input: {
    orderId: string;
    senderId: string;
    content: string;
  },
) {
  await tx.p2PMessage.create({
    data: {
      orderId: input.orderId,
      senderId: input.senderId,
      content: input.content,
      isSystem: true,
    },
  });
}
