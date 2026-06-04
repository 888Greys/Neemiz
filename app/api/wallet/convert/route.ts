export const runtime = "nodejs";

export async function POST() {
  return Response.json(
    {
      error: "KES Coin conversion has been retired. KES Coin is backed by your fiat KES wallet automatically at 1:1.",
    },
    { status: 410 },
  );
}
