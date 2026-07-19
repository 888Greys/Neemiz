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
    const patch: { username?: string; imageUrl?: string } = {};
    if (!existing.username) {
      patch.username = await generateUniqueUsername(db, data);
    }
    // Backfill avatar when the row was created before Google meta landed.
    if (!existing.imageUrl && data?.imageUrl) {
      patch.imageUrl = data.imageUrl;
    }
    if (Object.keys(patch).length > 0) {
      return db.user.update({ where: { id: existing.id }, data: patch });
    }
    return existing;
  }

  // A new Supabase identity can collide on any unique column:
  //  - supabaseId  → a concurrent request already created this user
  //  - username    → two requests generated the same handle (race)
  //  - email/phone → another account already owns this contact (e.g. the user
  //                  signed up with email OTP and is now using Google with the
  //                  same address). We must not steal it, so drop the field.
  // Retry a few times, narrowing the data each pass, so this never 500s.
  let email = data?.email ?? null;
  let phone = data?.phone ?? null;
  if (
    !phone &&
    email &&
    (email.endsWith("@phone.nezeem.com") || email.endsWith("@phone.binaryoptionske.com"))
  ) {
    phone = email.split("@")[0];
  }


  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const username = await generateUniqueUsername(db, data);
      return await db.user.create({
        data: {
          supabaseId,
          email,
          phone,
          username,
          firstName: data?.firstName ?? null,
          lastName: data?.lastName ?? null,
          imageUrl: data?.imageUrl ?? null,
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }

      // Did a concurrent request already create *this* user? Use that row.
      const created = await db.user.findUnique({ where: { supabaseId } });
      if (created) {
        if (!created.isActive) throw new SuspendedAccountError();
        return created;
      }

      // Otherwise the conflict is on email/phone/username owned by someone else
      // (or a username race). Drop the offending field(s) and retry.
      const target = error.meta?.target;
      const fields = (Array.isArray(target) ? target : target ? [target] : []).map(String);
      if (fields.some((f) => f.includes("email"))) email = null;
      if (fields.some((f) => f.includes("phone"))) phone = null;
      // username collisions are handled by regenerating on the next pass
    }
  }

  // Final fallback: if a racing request created the row, return it.
  const fallback = await db.user.findUnique({ where: { supabaseId } });
  if (fallback) {
    if (!fallback.isActive) throw new SuspendedAccountError();
    return fallback;
  }
  throw new Error(`Could not create user for supabaseId after retries`);
}
