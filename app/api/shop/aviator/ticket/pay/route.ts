import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { Prisma, ShopTicketStatus } from "@prisma/client";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const cashier = await getOrCreateUser(user.id, { email: user.email, phone: user.phone });
  if (!cashier.shopId) {
    return Response.json({ error: "Only assigned shop cashiers can process ticket payouts" }, { status: 403 });
  }

  let body: { ticketCode?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const inputCode = body.ticketCode?.trim().toUpperCase() ?? "";
  if (!inputCode) {
    return Response.json({ error: "Provide a ticket code" }, { status: 400 });
  }

  const formattedCode = inputCode.startsWith("AV-") ? inputCode : `AV-${inputCode}`;

  try {
    const result = await db.$transaction(async (tx) => {
      // 1. Fetch ticket with lock
      const ticket = await tx.shopTicket.findFirst({
        where: {
          OR: [
            { ticketCode: formattedCode },
            { ticketCode: inputCode },
          ],
        },
        include: {
          round: { select: { crashPoint: true, state: true } },
          shop: { select: { id: true, name: true } },
        },
      });

      if (!ticket) {
        throw new Error("TICKET_NOT_FOUND");
      }

      if (ticket.paidAt || ticket.status === ShopTicketStatus.PAID) {
        throw new Error("ALREADY_PAID");
      }

      if (ticket.status === ShopTicketStatus.LOST || ticket.status === ShopTicketStatus.CANCELLED) {
        throw new Error("NOT_A_WINNER");
      }

      // Check crash point for auto-cashout tickets
      const crash = ticket.round.crashPoint ? Number(ticket.round.crashPoint) : null;
      const stake = Number(ticket.stake);
      const autoTarget = ticket.autoCashout ? Number(ticket.autoCashout) : null;

      let payoutAmount = Number(ticket.payout);

      if (ticket.status === ShopTicketStatus.PENDING) {
        if (crash !== null && autoTarget !== null && crash >= autoTarget) {
          payoutAmount = stake * autoTarget;
        } else {
          throw new Error("NOT_ELIGIBLE_FOR_PAYOUT");
        }
      }

      if (payoutAmount <= 0) {
        throw new Error("ZERO_PAYOUT");
      }

      // 2. Mark ticket as PAID and credit cash drawer log
      const updatedTicket = await tx.shopTicket.update({
        where: { id: ticket.id },
        data: {
          status: ShopTicketStatus.PAID,
          payout: new Prisma.Decimal(payoutAmount),
          paidAt: new Date(),
          paidByCashierId: cashier.id,
        },
        include: {
          round: { select: { roundNumber: true } },
        },
      });

      return {
        ticketCode: updatedTicket.ticketCode,
        roundNumber: updatedTicket.round.roundNumber,
        stake,
        payoutAmount,
        paidAt: updatedTicket.paidAt!.toISOString(),
      };
    });

    return Response.json({
      ok: true,
      message: `Cash payout of KSh ${result.payoutAmount.toLocaleString()} verified and recorded. Hand cash to player.`,
      redemption: result,
    });
  } catch (err: any) {
    if (err.message === "TICKET_NOT_FOUND") {
      return Response.json({ error: "Ticket not found" }, { status: 404 });
    }
    if (err.message === "ALREADY_PAID") {
      return Response.json({ error: "THIS TICKET HAS ALREADY BEEN PAID OUT!" }, { status: 400 });
    }
    if (err.message === "NOT_A_WINNER" || err.message === "NOT_ELIGIBLE_FOR_PAYOUT" || err.message === "ZERO_PAYOUT") {
      return Response.json({ error: "This ticket is not a winning ticket" }, { status: 400 });
    }
    console.error("Ticket payout processing failed:", err);
    return Response.json({ error: "Payout processing failed" }, { status: 500 });
  }
}
