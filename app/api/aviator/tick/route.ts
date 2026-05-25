/**
 * The standalone Go Aviator service owns the round loop.
 * This endpoint is kept only for stale callers and no longer advances Prisma
 * Aviator rounds.
 */
export async function GET() {
  return Response.json({ ok: true, engine: "aviator-service" });
}

export const POST = GET;
