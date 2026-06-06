import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { generateUniqueUsername } from "@/lib/user-identity";

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
    if (!existing.username) {
      const username = await generateUniqueUsername(db, data);
      return db.user.update({ where: { id: existing.id }, data: { username } });
    }
    return existing;
  }

  try {
    const username = await generateUniqueUsername(db, data);
    return await db.user.create({
      data: {
        supabaseId,
        email: data?.email ?? null,
        phone: data?.phone ?? null,
        username,
        firstName: data?.firstName ?? null,
        lastName: data?.lastName ?? null,
        imageUrl: data?.imageUrl ?? null,
      },
    });
  } catch (error) {
    // Concurrent authenticated requests can both observe a missing user. The
    // request that loses the unique-key race should use the row just created.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const created = await db.user.findUnique({ where: { supabaseId } });
      if (created) {
        if (!created.isActive) throw new SuspendedAccountError();
        return created;
      }
    }
    throw error;
  }
}
