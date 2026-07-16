import { db } from "@/lib/db";
import { AdminV2DepositAddresses, type AddressRow } from "@/components/admin-v2/deposit-addresses";

export const metadata = { title: "Deposit addresses · Nezeem Admin" };
export const dynamic = "force-dynamic";

function family(network: string): string {
  if (network === "TRC20") return "TRON";
  if (network === "BITCOIN") return "BTC";
  return "EVM";
}

export default async function NewAdminDepositAddressesPage() {
  const addresses = await db.cryptoDepositAddress.findMany({
    include: { user: { select: { email: true, username: true } } },
    orderBy: [{ network: "asc" }, { createdAt: "asc" }],
  });

  const rows: AddressRow[] = addresses.map((a) => ({
    address: a.address,
    crypto: a.crypto,
    network: a.network,
    family: family(a.network),
    owner: a.user.email ?? a.user.username ?? a.userId,
    createdAt: a.createdAt.toISOString(),
  }));

  return <AdminV2DepositAddresses rows={rows} />;
}
