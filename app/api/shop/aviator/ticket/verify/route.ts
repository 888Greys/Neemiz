import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { ShopTicketStatus } from "@prisma/client";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const cashier = await getOrCreateUser(user.id, { email: user.email, phone: user.phone });
  if (!cashier.shopId) {
    return Response.json({ error: "Only assigned shop cashiers can verify shop tickets" }, { status: 403 });
  }

  const url = new URL(req.url);
  const codeParam = url.searchParams.get("code")?.trim().toUpperCase() ?? "";
  if (!codeParam) {
    return Response.json({ error: "Provide a ticket code or barcode parameter" }, { status: 400 });
  }

  // Format check: allow user to type "AV-7X9K2M" or "7X9K2M"
  const formattedCode = codeParam.startsWith("AV-") ? codeParam : `AV-${codeParam}`;

  const ticket = await db.shopTicket.findFirst({
    where: {
      OR: [
        { ticketCode: formattedCode },
        { ticketCode: codeParam },
        { id: codeParam },
      ],
    },
    include: {
      shop: { select: { name: true, code: true } },
      round: { select: { roundNumber: true, crashPoint: true, state: true } },
      cashier: { select: { username: true } },
      paidByCashier: { select: { username: true } },
    },
  });

  if (!ticket) {
    return Response.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Calculate live/settled status if round completed
  const roundCrash = ticket.round.crashPoint ? Number(ticket.round.crashPoint) : null;
  const stake = Number(ticket.stake);
  const autoTarget = ticket.autoCashout ? Number(ticket.autoCashout) : null;

  let calculatedStatus = ticket.status;
  let calculatedPayout = Number(ticket.payout);
  let calculatedMultiplier = ticket.cashoutMultiplier ? Number(ticket.cashoutMultiplier) : null;

  if (ticket.status === ShopTicketStatus.PENDING && roundCrash !== null) {
    if (autoTarget !== null && roundCrash >= autoTarget) {
      calculatedStatus = ShopTicketStatus.WON;
      calculatedMultiplier = autoTarget;
      calculatedPayout = stake * autoTarget;
    } else if (roundCrash < (autoTarget ?? 999999)) {
      calculatedStatus = ShopTicketStatus.LOST;
      calculatedPayout = 0;
    }
  }

  return Response.json({
    ok: true,
    ticket: {
      id: ticket.id,
      ticketCode: ticket.ticketCode,
      shopName: ticket.shop.name,
      shopCode: ticket.shop.code,
      cashierUsername: ticket.cashier.username ?? "Cashier",
      roundNumber: ticket.round.roundNumber,
      roundCrashPoint: roundCrash,
      roundState: ticket.round.state,
      stake,
      autoCashout: autoTarget,
      multiplier: calculatedMultiplier,
      payout: calculatedPayout,
      status: calculatedStatus,
      placedAt: ticket.placedAt.toISOString(),
      paidAt: ticket.paidAt ? ticket.paidAt.toISOString() : null,
      paidByCashier: ticket.paidByCashier?.username ?? null,
      isPayable: calculatedStatus === ShopTicketStatus.WON && !ticket.paidAt,
    },
  });
}
