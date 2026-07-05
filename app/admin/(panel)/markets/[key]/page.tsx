import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { MarketDetailClient } from "@/components/admin-market-detail-client";
import { MARKET_KEYS, MARKET_LABELS, type MarketKey } from "@/lib/admin/metrics";

export function generateMetadata({ params }: { params: { key: string } }) {
  const label = MARKET_LABELS[params.key as MarketKey];
  return { title: label ? `${label} · Nezeem Admin` : "Market · Nezeem Admin" };
}

export default async function MarketPage({ params }: { params: { key: string } }) {
  if (!MARKET_KEYS.includes(params.key as MarketKey)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  return (
    <AdminShell adminEmail={email}>
      <MarketDetailClient marketKey={params.key as MarketKey} />
    </AdminShell>
  );
}
