import { Prisma, PrismaClient } from "@prisma/client";

type UserClient = PrismaClient | Prisma.TransactionClient;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function usernameBase(data?: {
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
}): string {
  const preferred = data?.username || data?.firstName || data?.email?.split("@")[0] || data?.phone || "user";
  const cleaned = normalizeUsername(preferred).replace(/[^a-z0-9_]/g, "").slice(0, 14);
  return cleaned.length >= 3 ? cleaned : `user${cleaned}`;
}

export async function generateUniqueUsername(
  client: UserClient,
  data?: {
    username?: string | null;
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
  },
): Promise<string> {
  const base = usernameBase(data);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = attempt === 0 ? "" : Math.floor(1000 + Math.random() * 9000).toString();
    const candidate = `${base.slice(0, 20 - suffix.length)}${suffix}`;
    const exists = await client.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }

  return `user${Date.now().toString(36)}`.slice(0, 20);
}

export function recipientLookupWhere(query: string): Prisma.UserWhereInput {
  const value = query.trim();
  return {
    isActive: true,
    OR: [
      { username: { contains: normalizeUsername(value), mode: "insensitive" } },
      { email: { contains: value, mode: "insensitive" } },
      { phone: { contains: value.replace(/\s+/g, "") } },
    ],
  };
}
