import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * Finds the DB user by Clerk ID, creating the record if it doesn't exist yet.
 * This handles the case where the Clerk webhook missed the user.created event.
 */
export async function getOrCreateUser(clerkId: string) {
  // Fast path — user already exists
  const existing = await db.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  // Fetch from Clerk and create
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkId);

  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  )?.emailAddress ?? null;

  const primaryPhone = clerkUser.phoneNumbers.find(
    (p) => p.id === clerkUser.primaryPhoneNumberId
  )?.phoneNumber ?? null;

  return db.user.upsert({
    where: { clerkId },
    update: {},
    create: {
      clerkId,
      email: primaryEmail,
      phone: primaryPhone,
      username: clerkUser.username ?? null,
      firstName: clerkUser.firstName ?? null,
      lastName: clerkUser.lastName ?? null,
      imageUrl: clerkUser.imageUrl ?? null,
    },
  });
}
