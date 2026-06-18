import type { Prisma } from "@prisma/client";

type TxClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

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
    },
  });
}
