import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { Prisma, ShopTicketStatus } from "@prisma/client";
import { randomBytes } from "crypto";

function generateTicketCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // exclude ambiguous 0/O, 1/I
  let code = "AV-";
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const cashier = await getOrCreateUser(user.id, { email: user.email, phone: user.phone });
  if (!cashier.shopId) {
    return Response.json({ error: "Only assigned shop cashiers can place shop tickets" }, { status: 403 });
  }

  let body: { stake?: number; autoCashout?: number; roundId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const stake = Number(body.stake);
  if (!Number.isFinite(stake) || stake < 10) {
    return Response.json({ error: "Minimum shop ticket stake is KSh 10" }, { status: 400 });
  }

  const autoCashout = body.autoCashout ? Number(body.autoCashout) : null;
  if (autoCashout !== null && (!Number.isFinite(autoCashout) || autoCashout < 1.01)) {
    return Response.json({ error: "Auto-cashout target must be at least 1.01x" }, { status: 400 });
  }

  // Find latest active or waiting round if not provided
  let roundId = body.roundId;
  if (!roundId) {
    const latestRound = await db.aviatorRound.findFirst({
      where: { state: { in: ["WAITING", "BETTING", "FLYING"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, roundNumber: true },
    });
    if (!latestRound) {
      return Response.json({ error: "No active Aviator round available" }, { status: 404 });
    }
    roundId = latestRound.id;
  }

  try {
    const ticket = await db.$transaction(async (tx) => {
      // 1. Verify shop float
      const shop = await tx.shop.findUnique({
        where: { id: cashier.shopId! },
      });
      if (!shop || !shop.isActive) {
        throw new Error("SHOP_INACTIVE");
      }
      if (Number(shop.floatBalance) < stake) {
        throw new Error("INSUFFICIENT_FLOAT");
      }

      // 2. Debit shop float
      await tx.shop.update({
        where: { id: shop.id },
        data: { floatBalance: { decrement: stake } },
      });

      // 3. Generate unique ticket code
      let ticketCode = generateTicketCode();
      let exists = await tx.shopTicket.findUnique({ where: { ticketCode } });
      while (exists) {
        ticketCode = generateTicketCode();
        exists = await tx.shopTicket.findUnique({ where: { ticketCode } });
      }

      // 4. Create ShopTicket
      return await tx.shopTicket.create({
        data: {
          ticketCode,
          shopId: shop.id,
          cashierId: cashier.id,
          roundId: roundId!,
          stake: new Prisma.Decimal(stake),
          autoCashout: autoCashout ? new Prisma.Decimal(autoCashout) : null,
          status: ShopTicketStatus.PENDING,
        },
        include: {
          shop: { select: { name: true, code: true } },
          round: { select: { roundNumber: true } },
        },
      });
    });

    return Response.json({
      ok: true,
      ticket: {
        id: ticket.id,
        ticketCode: ticket.ticketCode,
        shopName: ticket.shop.name,
        shopCode: ticket.shop.code,
        roundNumber: ticket.round.roundNumber,
        stake: Number(ticket.stake),
        autoCashout: ticket.autoCashout ? Number(ticket.autoCashout) : null,
        placedAt: ticket.placedAt.toISOString(),
      },
    });
  } catch (err: any) {
    if (err.message === "INSUFFICIENT_FLOAT") {
      return Response.json({ error: "Insufficient cashier shop float balance" }, { status: 400 });
    }
    if (err.message === "SHOP_INACTIVE") {
      return Response.json({ error: "Shop is currently inactive" }, { status: 403 });
    }
    console.error("Shop ticket placement failed:", err);
    return Response.json({ error: "Failed to place ticket" }, { status: 500 });
  }
}
