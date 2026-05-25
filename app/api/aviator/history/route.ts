/**
 * The standalone Go Aviator service is now the round source of truth.
 * It does not expose public history yet, so avoid mixing old Prisma rounds
 * with live Go rounds in the UI.
 */
export async function GET() {
  return Response.json([]);
}
