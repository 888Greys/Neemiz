"use client";

import { useEffect, useState } from "react";
import { AdminV2DepositAddresses, type AddressRow } from "./deposit-addresses";

// Client wrapper so the deposit-address register can live inside the Treasury
// hub (which is a client component). Fetches the same rows the old page rendered.
export function DepositAddressesTab() {
  const [rows, setRows] = useState<AddressRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/crypto/deposit-addresses", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRows(d.rows as AddressRow[]))
      .catch(() => setError(true));
  }, []);

  if (error) return <div className="p-8 text-sm text-red-400">Deposit addresses could not be loaded.</div>;
  if (!rows) return <div className="flex h-48 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[#adc6ff]" /></div>;
  return <AdminV2DepositAddresses rows={rows} />;
}
