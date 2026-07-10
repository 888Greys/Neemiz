import { notFound } from "next/navigation";
import { AdminV2Market } from "@/components/admin-v2/market";
import { MARKET_KEYS, MARKET_LABELS, type MarketKey } from "@/lib/admin/metrics";

export function generateMetadata({ params }: { params: { key: string } }) {
  const label = MARKET_LABELS[params.key as MarketKey];
  return { title: label ? `${label} · Nezeem Admin` : "Market · Nezeem Admin" };
}

export default async function NewAdminMarketPage({ params }: { params: { key: string } }) {
  if (!MARKET_KEYS.includes(params.key as MarketKey)) notFound();
  return <AdminV2Market marketKey={params.key as MarketKey} />;
}
