import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import {
  withdrawalsDisabled,
  transfersDisabled,
  setWithdrawalsDisabled,
  setTransfersDisabled,
} from "@/lib/withdrawal-guard";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  if (!dbUser.isAdmin) return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  return { dbUser };
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
