import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/brevo";

type ClerkUserEvent = {
  type: string;
  data: {
    id: string;
    email_addresses: { email_address: string; id: string }[];
    phone_numbers: { phone_number: string; id: string }[];
    primary_email_address_id: string | null;
    primary_phone_number_id: string | null;
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
    const primaryEmail = data.primary_email_address_id
      ? data.email_addresses.find((e) => e.id === data.primary_email_address_id)?.email_address
      : undefined;

    const primaryPhone = data.primary_phone_number_id
      ? data.phone_numbers.find((p) => p.id === data.primary_phone_number_id)?.phone_number
      : undefined;

    // Must have at least one identifier
    if (!primaryEmail && !primaryPhone) {
      return new Response("No identifier found", { status: 400 });
    }

    await db.user.create({
      data: {
        clerkId: data.id,
        email: primaryEmail ?? null,
        phone: primaryPhone ?? null,
        username: data.username ?? null,
        firstName: data.first_name ?? null,
        lastName: data.last_name ?? null,
        imageUrl: data.image_url ?? null,
      },
    });

    if (primaryEmail) {
      try {
        await sendWelcomeEmail(primaryEmail, data.first_name ?? "");
      } catch (err) {
        console.error("Welcome email failed:", err);
      }
    }
  }

  if (type === "user.updated") {
    const primaryEmail = data.primary_email_address_id
      ? data.email_addresses.find((e) => e.id === data.primary_email_address_id)?.email_address
      : undefined;

    const primaryPhone = data.primary_phone_number_id
      ? data.phone_numbers.find((p) => p.id === data.primary_phone_number_id)?.phone_number
      : undefined;

    await db.user.update({
      where: { clerkId: data.id },
      data: {
        email: primaryEmail ?? null,
        phone: primaryPhone ?? null,
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
