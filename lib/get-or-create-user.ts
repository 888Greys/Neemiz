import { db } from "@/lib/db";

type UserData = {
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
};

/**
 * Finds the DB user by Supabase ID, creating the record if it doesn't exist yet.
 * Pass `data` on first call (e.g. from auth webhook or sign-up API route) so the
 * row is seeded with the user's profile info.
 */
export class SuspendedAccountError extends Error {
  constructor() { super("ACCOUNT_SUSPENDED"); }
}

export async function getOrCreateUser(supabaseId: string, data?: UserData) {
  const existing = await db.user.findUnique({ where: { supabaseId } });
  if (existing) {
    if (!existing.isActive) throw new SuspendedAccountError();
    return existing;
  }

  return db.user.create({
    data: {
      supabaseId,
      email: data?.email ?? null,
      phone: data?.phone ?? null,
      username: data?.username ?? null,
      firstName: data?.firstName ?? null,
      lastName: data?.lastName ?? null,
      imageUrl: data?.imageUrl ?? null,
    },
  });
}
