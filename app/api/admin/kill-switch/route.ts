import {
  withdrawalsDisabled,
  transfersDisabled,
  setWithdrawalsDisabled,
  setTransfersDisabled,
} from "@/lib/withdrawal-guard";
import { requireOwnerAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

// Full owner gate: auth + owner allowlist + is_admin + admin 2FA cookie.
async function requireAdmin() {
  const uid = await requireOwnerAdmin();
  if (!uid) return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  return { dbUser: { id: uid } };
}

// GET /api/admin/kill-switch — current state of the money-out switches.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const [withdrawals, transfers] = await Promise.all([withdrawalsDisabled(), transfersDisabled()]);
  return Response.json({
    withdrawalsDisabled: withdrawals,
    transfersDisabled:   transfers,
  }, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/admin/kill-switch — flip a switch instantly (no restart).
//   body: { switch: "withdrawals" | "transfers", disabled: boolean }
export async function POST(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: { switch?: string; disabled?: boolean };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { switch: which, disabled } = body;
  if (typeof disabled !== "boolean" || (which !== "withdrawals" && which !== "transfers")) {
    return Response.json({ error: "Provide switch ('withdrawals'|'transfers') and disabled (boolean)" }, { status: 400 });
  }

  if (which === "withdrawals") await setWithdrawalsDisabled(disabled);
  else await setTransfersDisabled(disabled);

  const [withdrawals, transfers] = await Promise.all([withdrawalsDisabled(), transfersDisabled()]);
  return Response.json({ ok: true, withdrawalsDisabled: withdrawals, transfersDisabled: transfers });
}
