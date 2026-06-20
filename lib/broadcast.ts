import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * Site-wide broadcasts (maintenance notices, updates, promos).
 *
 * Implemented with raw SQL against the `broadcasts` table so it works without a
 * freshly-generated Prisma client. The `Broadcast` model in schema.prisma mirrors
 * this shape for documentation and future typed access.
 */

export type BroadcastLevel = "info" | "warning" | "maintenance" | "success";

export type Broadcast = {
  id: string;
  title: string;
  message: string;
  level: BroadcastLevel;
  isActive: boolean;
  startsAt: string;
  endsAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

const ALLOWED_LEVELS: BroadcastLevel[] = ["info", "warning", "maintenance", "success"];

export function normalizeLevel(level: unknown): BroadcastLevel {
  return ALLOWED_LEVELS.includes(level as BroadcastLevel) ? (level as BroadcastLevel) : "info";
}

type Row = {
  id: string;
  title: string;
  message: string;
  level: string;
  is_active: boolean;
  starts_at: Date;
  ends_at: Date | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
};

function toBroadcast(r: Row): Broadcast {
  return {
    id: r.id,
    title: r.title,
    message: r.message,
    level: normalizeLevel(r.level),
    isActive: r.is_active,
    startsAt: r.starts_at.toISOString(),
    endsAt: r.ends_at ? r.ends_at.toISOString() : null,
    createdBy: r.created_by,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

/** Public: broadcasts currently live (active, started, not expired), newest first. */
export async function getActiveBroadcasts(): Promise<Broadcast[]> {
  const rows = await db.$queryRaw<Row[]>`
    SELECT * FROM public.broadcasts
    WHERE is_active = TRUE
      AND starts_at <= NOW()
      AND (ends_at IS NULL OR ends_at > NOW())
    ORDER BY created_at DESC
    LIMIT 5
  `;
  return rows.map(toBroadcast);
}

/** Admin: every broadcast, newest first. */
export async function listBroadcasts(): Promise<Broadcast[]> {
  const rows = await db.$queryRaw<Row[]>`
    SELECT * FROM public.broadcasts ORDER BY created_at DESC LIMIT 100
  `;
  return rows.map(toBroadcast);
}

export async function createBroadcast(input: {
  title: string;
  message: string;
  level: BroadcastLevel;
  endsAt?: Date | null;
  createdBy?: string | null;
}): Promise<Broadcast> {
  const id = `bc_${crypto.randomUUID().replace(/-/g, "")}`;
  const rows = await db.$queryRaw<Row[]>`
    INSERT INTO public.broadcasts (id, title, message, level, is_active, starts_at, ends_at, created_by, created_at, updated_at)
    VALUES (${id}, ${input.title}, ${input.message}, ${input.level}, TRUE, NOW(), ${input.endsAt ?? null}, ${input.createdBy ?? null}, NOW(), NOW())
    RETURNING *
  `;
  return toBroadcast(rows[0]);
}

export async function updateBroadcast(
  id: string,
  fields: { title?: string; message?: string; level?: BroadcastLevel; isActive?: boolean; endsAt?: Date | null },
): Promise<Broadcast | null> {
  const sets: Prisma.Sql[] = [];
  if (fields.title !== undefined) sets.push(Prisma.sql`title = ${fields.title}`);
  if (fields.message !== undefined) sets.push(Prisma.sql`message = ${fields.message}`);
  if (fields.level !== undefined) sets.push(Prisma.sql`level = ${fields.level}`);
  if (fields.isActive !== undefined) sets.push(Prisma.sql`is_active = ${fields.isActive}`);
  if (fields.endsAt !== undefined) sets.push(Prisma.sql`ends_at = ${fields.endsAt}`);
  if (sets.length === 0) return null;
  sets.push(Prisma.sql`updated_at = NOW()`);

  const rows = await db.$queryRaw<Row[]>`
    UPDATE public.broadcasts SET ${Prisma.join(sets, ", ")} WHERE id = ${id} RETURNING *
  `;
  return rows[0] ? toBroadcast(rows[0]) : null;
}

export async function deleteBroadcast(id: string): Promise<void> {
  await db.$executeRaw`DELETE FROM public.broadcasts WHERE id = ${id}`;
}
