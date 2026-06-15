import { notFound } from "next/navigation";
import { DEV_AUTH_ENABLED, DEV_ACCOUNTS } from "@/lib/dev-auth";
import { DevLoginClient } from "./dev-login-client";

export const dynamic = "force-dynamic";

// Dev-only sign-in page. 404s in production / when DEV_AUTH is off.
export default function DevLoginPage() {
  if (!DEV_AUTH_ENABLED) notFound();
  const accounts = DEV_ACCOUNTS.map((a) => ({ key: a.key, email: a.email, password: a.password, username: a.username }));
  return <DevLoginClient accounts={accounts} />;
}
