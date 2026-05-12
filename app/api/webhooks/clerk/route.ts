import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/brevo";

type ClerkUserEvent = {
  type: string;
  data: {
    id: string;
    email_addresses: { email_address: string; id: string }[];
    primary_email_address_id: string;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    image_url: string | null;
  };
};

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.text();

  let event: ClerkUserEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  const { type, data } = event;

  if (type === "user.created") {
    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id
    )?.email_address;

    if (!primaryEmail) {
      return new Response("No primary email found", { status: 400 });
    }

    await db.user.create({
      data: {
        clerkId: data.id,
        email: primaryEmail,
        username: data.username ?? null,
        firstName: data.first_name ?? null,
        lastName: data.last_name ?? null,
        imageUrl: data.image_url ?? null,
      },
    });

    try {
      await sendWelcomeEmail(primaryEmail, data.first_name ?? "");
    } catch (err) {
      // Don't fail the webhook if email sending fails — log and continue
      console.error("Welcome email failed:", err);
    }
  }

  if (type === "user.updated") {
    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id
    )?.email_address;

    await db.user.update({
      where: { clerkId: data.id },
      data: {
        email: primaryEmail,
        username: data.username ?? null,
        firstName: data.first_name ?? null,
        lastName: data.last_name ?? null,
        imageUrl: data.image_url ?? null,
      },
    });
  }

  if (type === "user.deleted") {
    await db.user.update({
      where: { clerkId: data.id },
      data: { isActive: false },
    });
  }

  return new Response("OK", { status: 200 });
}
