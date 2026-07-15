/**
 * POST /api/p2p/merchant/fund — DEPRECATED.
 *
 * On-chain sell ads now lock directly from the user wallet at create time.
 * There is no separate merchant escrow to fund.
 */
export async function POST() {
  return Response.json(
    {
      error:
        "Merchant escrow funding is no longer used. Sell ads lock crypto straight from your wallet.",
      code: "ESCROW_DEPRECATED",
    },
    { status: 410 },
  );
}
