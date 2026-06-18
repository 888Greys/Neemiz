import { Suspense } from "react";
import { headers, cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { P2PExpressClient } from "@/components/p2p-express-client";
import { P2PMarketPanel } from "@/components/p2p-market-panel";
import { detectFiatFromHeaders, isSupportedFiat } from "@/lib/p2p/currencies";

export const metadata = {
  title: "Express Buy · Nezeem P2P",
  description: "Instantly buy crypto at the best available price — we match you to a verified merchant automatically.",
};

export const dynamic = "force-dynamic";

export default function P2PExpressPage() {
  const cookieFiat = cookies().get("user_fiat")?.value;
  const headerList = headers();
  const defaultFiat = isSupportedFiat(cookieFiat)
    ? cookieFiat!
    : detectFiatFromHeaders((name) => headerList.get(name));

  return (
    <AppShell mainBg="bg-[#050505]" rightPanel={<P2PMarketPanel />} hideFooter>
      <div>
        <Suspense>
          <P2PExpressClient defaultFiat={defaultFiat} />
        </Suspense>
      </div>
    </AppShell>
  );
}
